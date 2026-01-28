from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone, timedelta
from .config import get_settings

# Turkey timezone
TURKEY_TZ = timezone(timedelta(hours=3))

def turkey_now() -> datetime:
    """Get current datetime in Turkey timezone"""
    return datetime.now(TURKEY_TZ)

settings = get_settings()

# SQLite requires connect_args for threading support
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    # Import models to register them with Base
    from . import models  # This imports all models which register with Base
    Base.metadata.create_all(bind=engine)


def reset_db():
    """Drop and recreate all tables (for testing)"""
    # Import models to register them with Base
    from . import models
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
