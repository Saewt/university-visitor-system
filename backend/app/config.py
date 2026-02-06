from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from pathlib import Path
import os


class Settings(BaseSettings):
    # Database - SQLite (file-based)
    database_url: str = "sqlite:///./university_visitors.db"

    # JWT - SECRET_KEY with development default
    secret_key: str = Field(default="dev-secret-key-change-in-production", env="SECRET_KEY")
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
