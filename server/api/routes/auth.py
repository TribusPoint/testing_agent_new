import uuid
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.database import get_db, AsyncSessionLocal
from models.tables import ApiKey
from config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

_master_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def _hash(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()


def _require_master(key: str | None = Security(_master_header)) -> None:
    if not key or key != settings.MASTER_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Master key required")


class KeyCreate(BaseModel):
    name: str


class KeyResponse(BaseModel):
    id: str
    name: str
    is_active: bool
    created_at: str


class KeyCreated(KeyResponse):
    plain_key: str


@router.post("/keys", response_model=KeyCreated, status_code=201)
async def create_key(
    body: KeyCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_master),
):
    existing = await db.execute(select(ApiKey).where(ApiKey.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Key named '{body.name}' already exists")

    plain = f"ta_{uuid.uuid4().hex}"
    key = ApiKey(name=body.name, key_hash=_hash(plain))
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return KeyCreated(
        id=key.id,
        name=key.name,
        is_active=key.is_active,
        created_at=key.created_at.isoformat(),
        plain_key=plain,
    )


@router.get("/keys", response_model=list[KeyResponse])
async def list_keys(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_master),
):
    result = await db.execute(select(ApiKey).order_by(ApiKey.created_at))
    return [
        KeyResponse(id=k.id, name=k.name, is_active=k.is_active, created_at=k.created_at.isoformat())
        for k in result.scalars().all()
    ]


@router.delete("/keys/{key_id}", status_code=204)
async def revoke_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_master),
):
    key = await db.get(ApiKey, key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    key.is_active = False
    await db.commit()


@router.post("/verify")
async def verify_key(raw_key: str | None = Security(_master_header)):
    """
    Used by the frontend to confirm a key works.
    Returns the key name if valid, 401 otherwise.
    """
    if not raw_key:
        raise HTTPException(status_code=401, detail="Missing key")

    # Master key check
    if raw_key == settings.MASTER_API_KEY:
        return {"valid": True, "name": "master"}

    key_hash = _hash(raw_key)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)
        )
        row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")
    return {"valid": True, "name": row.name}
