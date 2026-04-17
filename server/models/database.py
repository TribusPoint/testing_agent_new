from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from config import settings
__all__ = ["engine", "AsyncSessionLocal", "get_db"]


def _missing_db_msg() -> str:
    return (
        "DATABASE_URL is not set. On Railway: add a PostgreSQL database (New → Database → PostgreSQL), "
        "then in your app service → Variables → add DATABASE_URL and reference your Postgres service "
        "(e.g. ${{ Postgres.DATABASE_URL }} or use the 'Connect' / 'Variables' shortcut Railway shows)."
    )


if not (settings.effective_database_url or "").strip():
    raise RuntimeError(_missing_db_msg())

_async_url = settings.db_url_async
# asyncpg otherwise may hang a long time when Postgres is down or misconfigured.
_engine_kw: dict = {"echo": False}
if "asyncpg" in _async_url:
    _engine_kw["connect_args"] = {"timeout": 12}

engine = create_async_engine(_async_url, **_engine_kw)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
