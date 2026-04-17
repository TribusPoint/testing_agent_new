import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models.database import get_db, AsyncSessionLocal
from models.tables import User, PasswordResetRequest
from config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

_master_header = APIKeyHeader(name="X-API-Key", auto_error=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _create_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _user_response(u: User) -> "UserResponse":
    return UserResponse(
        id=u.id, email=u.email, name=u.name,
        role=u.role, is_active=u.is_active,
        must_change_password=u.must_change_password,
        created_at=u.created_at.isoformat(),
    )


_admin_bearer = HTTPBearer(auto_error=False)


async def _require_admin(
    key: str | None = Security(_master_header),
    bearer: HTTPAuthorizationCredentials | None = Security(_admin_bearer),
) -> None:
    """Accept master API key OR admin JWT token."""
    if key and key == settings.MASTER_API_KEY:
        return
    if bearer and bearer.credentials:
        from api.middleware.auth import _decode_jwt_token
        user_id = await _decode_jwt_token(bearer.credentials)
        if user_id:
            async with AsyncSessionLocal() as db:
                user = await db.get(User, user_id)
                if user and user.is_active and user.role == "admin":
                    return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


_bearer_scheme = HTTPBearer(auto_error=False)


async def _get_current_user(
    db: AsyncSession = Depends(get_db),
    bearer: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),
) -> User:
    """Extract the current user from a JWT Bearer token."""
    if not bearer or not bearer.credentials:
        raise HTTPException(status_code=401, detail="Bearer token required")
    from api.middleware.auth import _decode_jwt_token
    user_id = await _decode_jwt_token(bearer.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    """`email` is the sign-in identifier: member emails, or Username `admin` for the seeded admin@admin.com account."""

    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _strip_login_ident(cls, v: object) -> str:
        if not isinstance(v, str):
            raise ValueError("Invalid sign-in identifier")
        s = v.strip()
        if not s:
            raise ValueError("Email or Username is required")
        return s


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    must_change_password: bool = False
    created_at: str


class MessageResponse(BaseModel):
    message: str


class UserUpdateRequest(BaseModel):
    name: str | None = None
    role: str | None = None
    is_active: bool | None = None


class AdminCreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "member"


class AdminChangePasswordRequest(BaseModel):
    """Admin-only user reset. `secret` must match settings.ADMIN_PASSWORD_SECRET_CODE. Members use POST /change-password instead."""

    password: str
    secret: str


class SelfChangePasswordRequest(BaseModel):
    """Self-service password change. Admin users must send `secret` matching ADMIN_PASSWORD_SECRET_CODE."""

    current_password: str
    new_password: str
    secret: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ApproveResetRequest(BaseModel):
    temp_password: str
    secret: str


class PasswordResetResponse(BaseModel):
    id: str
    user_id: str
    user_email: str
    user_name: str
    status: str
    created_at: str


# ---------------------------------------------------------------------------
# Legacy admin login (same as POST /login with email=admin + password).
# Prefer unified /login with identifier "admin" or admin@admin.com.
# ---------------------------------------------------------------------------

@router.post("/admin-login", response_model=TokenResponse)
async def admin_login(body: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    if body.username != "admin":
        raise HTTPException(status_code=401, detail="Invalid credentials")

    result = await db.execute(select(User).where(User.email == "admin@admin.com"))
    user = result.scalar_one_or_none()
    if not user or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    token = _create_token(user.id, user.role)
    return TokenResponse(access_token=token, user=_user_response(user))


# ---------------------------------------------------------------------------
# User Registration & Login
# ---------------------------------------------------------------------------

@router.post("/register", response_model=MessageResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(func.lower(User.email) == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    user = User(
        email=body.email.lower(),
        password_hash=_hash_password(body.password),
        name=body.name,
        role="member",
        is_active=False,
    )
    db.add(user)
    await db.commit()
    return MessageResponse(message="Account created. An admin must activate your account before you can log in.")


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    ident = body.email
    lowered = ident.lower()
    if lowered == "admin":
        result = await db.execute(select(User).where(User.email == "admin@admin.com"))
    else:
        result = await db.execute(select(User).where(func.lower(User.email) == lowered))
    user = result.scalar_one_or_none()

    if not user or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account is pending admin approval. Please wait for activation.")

    token = _create_token(user.id, user.role)
    return TokenResponse(access_token=token, user=_user_response(user))


# ---------------------------------------------------------------------------
# Current User
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(_get_current_user)):
    return _user_response(user)


# ---------------------------------------------------------------------------
# Self-service: Change Own Password
# ---------------------------------------------------------------------------

@router.post("/change-password", response_model=MessageResponse)
async def change_own_password(
    body: SelfChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_get_current_user),
):
    if not _verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if user.role == "admin":
        secret = (body.secret or "").strip()
        code = (settings.ADMIN_PASSWORD_SECRET_CODE or "").strip()
        if not code:
            raise HTTPException(
                status_code=400,
                detail="Admin password secret is not configured on the server",
            )
        if not secret or not secrets.compare_digest(secret, code):
            raise HTTPException(status_code=401, detail="Invalid admin secret code")
    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    user.password_hash = _hash_password(body.new_password)
    user.must_change_password = False
    await db.commit()
    return MessageResponse(message="Password changed successfully.")


# ---------------------------------------------------------------------------
# Forgot Password (public)
# ---------------------------------------------------------------------------

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Create a password reset request. Returns success regardless to avoid email enumeration."""
    result = await db.execute(select(User).where(func.lower(User.email) == body.email.lower()))
    user = result.scalar_one_or_none()
    if user:
        existing_pending = await db.execute(
            select(PasswordResetRequest).where(
                PasswordResetRequest.user_id == user.id,
                PasswordResetRequest.status == "pending",
            )
        )
        if not existing_pending.scalar_one_or_none():
            req = PasswordResetRequest(user_id=user.id, status="pending")
            db.add(req)
            await db.commit()
    return MessageResponse(message="If that email exists, a password reset request has been sent to the admin.")


# ---------------------------------------------------------------------------
# Password Reset Management (admin only)
# ---------------------------------------------------------------------------

@router.get("/password-resets", response_model=list[PasswordResetResponse])
async def list_password_resets(db: AsyncSession = Depends(get_db), _: None = Depends(_require_admin)):
    result = await db.execute(
        select(PasswordResetRequest)
        .where(PasswordResetRequest.status == "pending")
        .order_by(PasswordResetRequest.created_at)
    )
    resets = result.scalars().all()
    out = []
    for r in resets:
        user = await db.get(User, r.user_id)
        if user:
            out.append(PasswordResetResponse(
                id=r.id, user_id=r.user_id, user_email=user.email,
                user_name=user.name, status=r.status,
                created_at=r.created_at.isoformat(),
            ))
    return out


@router.post("/password-resets/{reset_id}/approve", response_model=MessageResponse)
async def approve_password_reset(
    reset_id: str,
    body: ApproveResetRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    secret = (body.secret or "").strip()
    code = (settings.ADMIN_PASSWORD_SECRET_CODE or "").strip()
    if not secret or not code:
        raise HTTPException(status_code=400, detail="Secret code is required to approve a password reset")
    if not secrets.compare_digest(secret, code):
        raise HTTPException(status_code=401, detail="Invalid secret code")

    req = await db.get(PasswordResetRequest, reset_id)
    if not req or req.status != "pending":
        raise HTTPException(status_code=404, detail="Reset request not found")
    user = await db.get(User, req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if len(body.temp_password) < 4:
        raise HTTPException(status_code=400, detail="Temporary password must be at least 4 characters")

    user.password_hash = _hash_password(body.temp_password)
    user.must_change_password = True
    req.status = "approved"
    await db.commit()
    return MessageResponse(message=f"Password reset for {user.email}. They must change it on next login.")


@router.delete("/password-resets/{reset_id}", status_code=204)
async def reject_password_reset(
    reset_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    req = await db.get(PasswordResetRequest, reset_id)
    if not req:
        raise HTTPException(status_code=404, detail="Reset request not found")
    req.status = "rejected"
    await db.commit()


# ---------------------------------------------------------------------------
# User Management (admin only)
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db), _: None = Depends(_require_admin)):
    result = await db.execute(select(User).order_by(User.created_at))
    return [_user_response(u) for u in result.scalars().all()]


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    body: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.name is not None:
        user.name = body.name
    if body.role is not None:
        if body.role not in ("admin", "member"):
            raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active

    await db.commit()
    await db.refresh(user)
    return _user_response(user)


@router.post("/users", response_model=UserResponse, status_code=201)
async def admin_create_user(
    body: AdminCreateUserRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    existing = await db.execute(select(User).where(func.lower(User.email) == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    if body.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    user = User(
        email=body.email.lower(),
        password_hash=_hash_password(body.password),
        name=body.name,
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _user_response(user)


@router.patch("/users/{user_id}/password", status_code=200)
async def admin_change_user_password(
    user_id: str,
    body: AdminChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    secret = (body.secret or "").strip()
    code = (settings.ADMIN_PASSWORD_SECRET_CODE or "").strip()
    if not secret or not code:
        raise HTTPException(status_code=400, detail="Secret code is required")
    if not secrets.compare_digest(secret, code):
        raise HTTPException(status_code=401, detail="Invalid secret code")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    user.password_hash = _hash_password(body.password)
    user.must_change_password = True
    await db.commit()
    return {"ok": True, "message": f"Password updated for {user.email}"}


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()


@router.post("/verify")
async def verify_key(raw_key: str | None = Security(_master_header)):
    """Confirm master key or JWT (optional health / tooling)."""
    if not raw_key:
        raise HTTPException(status_code=401, detail="Missing key")

    if raw_key == settings.MASTER_API_KEY:
        return {"valid": True, "name": "master"}

    if raw_key.startswith("ey"):
        from api.middleware.auth import _decode_jwt_token
        user_id = await _decode_jwt_token(raw_key)
        if user_id:
            async with AsyncSessionLocal() as db:
                user = await db.get(User, user_id)
                if user and user.is_active:
                    return {"valid": True, "name": user.name, "user_id": user.id, "role": user.role}
        raise HTTPException(status_code=401, detail="Invalid token")

    raise HTTPException(status_code=401, detail="Invalid key or token")
