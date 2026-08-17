from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./chatapp.db"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    TAVILY_API_KEY: str = ""
    AI_CONTEXT_MESSAGE_LIMIT: int = 20
    # Comma-separated list, e.g. "https://yourdomain.com,https://www.yourdomain.com"
    # Defaults wide open for local dev; set explicitly before deploying.
    ALLOWED_ORIGINS: str = "*"
    # MUST be overridden in production .env — a default/leaked secret lets
    # anyone forge a login session for any account. Generate a real one with:
    #   python -c "import secrets; print(secrets.token_hex(32))"
    JWT_SECRET: str = "dev-insecure-secret-change-me-before-deploying"
    JWT_EXPIRE_DAYS: int = 30

    class Config:
        env_file = ".env"


settings = Settings()
