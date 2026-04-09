import re
from pydantic_settings import BaseSettings


def _to_async_url(url: str) -> str:
    """Convert any postgres URL to asyncpg format."""
    return re.sub(r"^postgres(ql)?(\+\w+)?://", "postgresql+asyncpg://", url)


def _to_sync_url(url: str) -> str:
    """Convert any postgres URL to psycopg2 format."""
    return re.sub(r"^postgres(ql)?(\+\w+)?://", "postgresql+psycopg2://", url)


class Settings(BaseSettings):
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Railway provides DATABASE_URL as postgresql://...
    # We accept that and auto-derive the async/sync variants.
    DATABASE_URL: str = ""
    DATABASE_URL_SYNC: str = ""

    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    SECRET_KEY: str = "change-me"
    MASTER_API_KEY: str = "master-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    CORS_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3001,http://127.0.0.1:3001"
    )

    LLM_PROVIDER: str = "openai"
    GENERATION_MODEL: str = "gpt-4o"
    EVALUATION_MODEL: str = "gpt-4o"
    UTTERANCE_MODEL: str = "gpt-4o-mini"

    SF_TURN_TIMEOUT: int = 30
    SF_MAX_RETRIES: int = 3
    SF_RETRY_DELAY: float = 1.0
    MAX_CONV_CHARS: int = 8000
    MAX_FOLLOW_UPS: int = 5

    class Config:
        env_file = ".env"

    @property
    def db_url_async(self) -> str:
        return _to_async_url(self.DATABASE_URL)

    @property
    def db_url_sync(self) -> str:
        if self.DATABASE_URL_SYNC:
            return _to_sync_url(self.DATABASE_URL_SYNC)
        return _to_sync_url(self.DATABASE_URL)


settings = Settings()
