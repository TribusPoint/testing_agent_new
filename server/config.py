from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_ENV: str = "development"
    DEBUG: bool = True
    DATABASE_URL: str
    DATABASE_URL_SYNC: str
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    SECRET_KEY: str = "change-me"
    MASTER_API_KEY: str = "master-change-me"

    # LLM routing
    LLM_PROVIDER: str = "openai"          # "openai" | "anthropic"
    GENERATION_MODEL: str = "gpt-4o"
    EVALUATION_MODEL: str = "gpt-4o"
    UTTERANCE_MODEL: str = "gpt-4o-mini"

    # Conversation engine
    SF_TURN_TIMEOUT: int = 30       # seconds per Salesforce send_message call
    SF_MAX_RETRIES: int = 3         # retry attempts for Salesforce session/message calls
    SF_RETRY_DELAY: float = 1.0     # base delay seconds (doubles each retry)
    MAX_CONV_CHARS: int = 8000      # max conversation chars before trimming for LLM
    MAX_FOLLOW_UPS: int = 5         # max follow-up turns per question

    class Config:
        env_file = ".env"

settings = Settings()