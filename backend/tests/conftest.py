"""
Pytest configuration and fixtures for testing.
"""
import os
import sys
import pytest
from datetime import timedelta
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from fastapi import FastAPI

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# IMPORTANT: Import models BEFORE Base to ensure they're registered
from app.models import User, Department, Student
from app.database import Base, get_db, turkey_now
from app.routers.auth import create_access_token, get_password_hash
from app.routers import students, stats, export, auth


def create_test_app():
    """Create a test FastAPI app without lifespan (no seeding)."""
    test_app = FastAPI(
        title="University Visitor Registration API - Test",
        version="1.0.0"
    )

    # Add CORS middleware
    from fastapi.middleware.cors import CORSMiddleware
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    test_app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
    test_app.include_router(students.router, prefix="/api/students", tags=["Students"])
    test_app.include_router(stats.router, prefix="/api/stats", tags=["Statistics"])
    test_app.include_router(export.router, prefix="/api/export", tags=["Export"])

    # Health endpoint
    @test_app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    return test_app


# Use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """
    Create a new database session with fresh tables for each test function.
    This fixture combines engine creation and session management.
    """
    # Create engine
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Create session
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    yield session

    # Cleanup
    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def client(db_session: Session):
    """Create a test client with a dependency override for the database."""
    test_app = create_test_app()

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    test_app.dependency_overrides[get_db] = override_get_db
    with TestClient(test_app) as test_client:
        yield test_client
    test_app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db_session: Session) -> User:
    """Create an admin user for testing."""
    admin = User(
        username="testadmin",
        password_hash=get_password_hash("admin123"),
        role="admin"
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture
def teacher_user(db_session: Session) -> User:
    """Create a teacher user for testing."""
    teacher = User(
        username="testteacher",
        password_hash=get_password_hash("teacher123"),
        role="teacher"
    )
    db_session.add(teacher)
    db_session.commit()
    db_session.refresh(teacher)
    return teacher


@pytest.fixture
def admin_token(admin_user: User) -> str:
    """Create a valid JWT token for admin user."""
    return create_access_token(data={
        "sub": admin_user.username,
        "user_id": admin_user.id,
        "role": admin_user.role
    })


@pytest.fixture
def teacher_token(teacher_user: User) -> str:
    """Create a valid JWT token for teacher user."""
    return create_access_token(data={
        "sub": teacher_user.username,
        "user_id": teacher_user.id,
        "role": teacher_user.role
    })


@pytest.fixture
def admin_headers(admin_token: str) -> dict:
    """Create headers with admin authorization."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def teacher_headers(teacher_token: str) -> dict:
    """Create headers with teacher authorization."""
    return {"Authorization": f"Bearer {teacher_token}"}


@pytest.fixture
def sample_departments(db_session: Session) -> list:
    """Create sample departments for testing."""
    departments = [
        Department(name="Tıp", telegram_chat_id="-1001", active=True),
        Department(name="Diş Hekimliği", telegram_chat_id="-1002", active=True),
        Department(name="Eczacılık", telegram_chat_id="-1003", active=True),
        Department(name="Hukuk", telegram_chat_id="-1004", active=True),
        Department(name="Mimarlık", telegram_chat_id="-1005", active=True),
        Department(name="Mühendislik Fakültesi", telegram_chat_id="-1006", active=True),
        Department(name="İşletme", telegram_chat_id="-1007", active=True),
        Department(name="Psikoloji", telegram_chat_id="-1008", active=True),
    ]
    for dept in departments:
        db_session.add(dept)
    db_session.commit()

    # Refresh to get IDs
    for dept in departments:
        db_session.refresh(dept)

    return departments


@pytest.fixture
def sample_student(db_session: Session, admin_user: User, sample_departments: list) -> Student:
    """Create a sample student for testing."""
    student = Student(
        first_name="Ahmet",
        last_name="Yılmaz",
        email="ahmet.yilmaz@example.com",
        phone="05321234567",
        high_school="İstanbul Lisesi",
        ranking=15000,
        yks_score=450.50,
        yks_type="SAYISAL",
        department_id=sample_departments[0].id,
        wants_tour=True,
        created_by_user_id=admin_user.id,
        created_at=turkey_now()
    )
    db_session.add(student)
    db_session.commit()
    db_session.refresh(student)
    return student


@pytest.fixture
def multiple_students(db_session: Session, admin_user: User, sample_departments: list) -> list:
    """Create multiple students for testing pagination and filtering."""
    students = []

    # Create students with varying attributes
    test_data = [
        ("Ahmet", "Yılmaz", "SAYISAL", 15000, 450.5, True, sample_departments[0].id),
        ("Mehmet", "Demir", "SOZEL", 25000, 420.0, False, sample_departments[3].id),
        ("Ayşe", "Kaya", "EA", 35000, 380.0, True, sample_departments[6].id),
        ("Fatma", "Şahin", "SAYISAL", 10000, 470.0, True, sample_departments[0].id),
        ("Ali", "Çelik", "DIL", 50000, 350.0, False, sample_departments[7].id),
    ]

    now = turkey_now()
    for i, (first_name, last_name, yks_type, ranking, score, tour, dept_id) in enumerate(test_data):
        student = Student(
            first_name=first_name,
            last_name=last_name,
            email=f"{first_name.lower()}.{last_name.lower()}@example.com",
            phone=f"0532{i:03d}4567",
            high_school="İstanbul Lisesi",
            ranking=ranking,
            yks_score=score,
            yks_type=yks_type,
            department_id=dept_id,
            wants_tour=tour,
            created_by_user_id=admin_user.id,
            created_at=now - timedelta(days=i)  # Stagger dates
        )
        db_session.add(student)
        students.append(student)

    db_session.commit()
    for student in students:
        db_session.refresh(student)

    return students


@pytest.fixture
def mock_sse_broadcast(monkeypatch):
    """Mock the SSE manager broadcast to avoid actual broadcasting during tests."""
    broadcast_called = []

    def mock_broadcast(data):
        broadcast_called.append(data)

    from app.services import sse
    monkeypatch.setattr(sse.manager, "broadcast", mock_broadcast)

    return broadcast_called


@pytest.fixture
def mock_telegram_notification(monkeypatch):
    """Mock the Telegram notification to avoid actual API calls."""
    notification_sent = []

    def mock_send_notification(student, db):
        notification_sent.append({
            "student_id": student.id,
            "department_id": student.department_id
        })

    from app.routers import students
    monkeypatch.setattr(students, "send_tour_notification", mock_send_notification)

    return notification_sent
