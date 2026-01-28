from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    # Database - SQLite (file-based)
    database_url: str = "sqlite:///./university_visitors.db"

    # JWT
    secret_key: str = "your-secret-key-here-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # Telegram
    telegram_bot_token: str = ""
    mock_telegram: bool = False

    # CORS
    frontend_url: str = "http://localhost:5173"

    # Environment
    environment: str = "development"

    # Database file path (for SQLite)
    db_file: Path = Path("university_visitors.db")

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings():
    return Settings()
