import jwt
from fastapi import Security, HTTPException, Request, status
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials

from models.database import AsyncSessionLocal
from models.tables import User
from config import settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
_bearer_scheme = HTTPBearer(auto_error=False)


async def _decode_jwt_token(token: str) -> str | None:
    """Decode a JWT and return the user_id (sub claim), or None if invalid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


async def verify_api_key(
    request: Request,
    api_key: str | None = Security(_api_key_header),
    bearer: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),
) -> str:
    """
    FastAPI dependency — accepts either:
      1. Authorization: Bearer <jwt>   -> resolves user, returns user name
      2. X-API-Key: <MASTER_API_KEY>   -> machine access (no user row)
    Attaches `request.state.user` when JWT auth is used.
    """
    if bearer and bearer.credentials:
        user_id = await _decode_jwt_token(bearer.credentials)
        if user_id:
            async with AsyncSessionLocal() as db:
                user = await db.get(User, user_id)
                if user and user.is_active:
                    request.state.user = user
                    return user.name

    if api_key and api_key == settings.MASTER_API_KEY:
        request.state.user = None
        return "master"

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid authentication. Provide Authorization: Bearer <JWT> or X-API-Key with the master key.",
    )
