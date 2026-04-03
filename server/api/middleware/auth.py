import hashlib
from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from models.database import AsyncSessionLocal
from models.tables import ApiKey

_header_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)


def _hash_key(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()


async def verify_api_key(api_key: str | None = Security(_header_scheme)) -> str:
    """
    FastAPI dependency — validates X-API-Key against the api_keys table.
    Returns the key name on success, raises 401 otherwise.
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
        )
    key_hash = _hash_key(api_key)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)
        )
        row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key",
        )
    return row.name
