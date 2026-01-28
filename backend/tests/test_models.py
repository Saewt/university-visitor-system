"""
Tests for database models.
"""
import pytest
from datetime import datetime, timedelta
from app.models import User, Department, Student


class TestUserModel:
    """Tests for User model."""

    def test_create_user(self, db_session):
        """Test creating a new user."""
        user = User(
            username="testuser",
            password_hash="hashed_password",
            role="teacher"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        assert user.id is not None
        assert user.username == "testuser"
        assert user.role == "teacher"

    def test_user_default_role(self, db_session):
        """Test default role for new user."""
        user = User(
            username="testuser",
            password_hash="hashed_password"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        assert user.role == "teacher"

    def test_user_timestamps(self, db_session):
        """Test user creation timestamp."""
        before = datetime.utcnow()
        user = User(
            username="testuser",
            password_hash="hashed"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        after = datetime.utcnow()
        assert before <= user.created_at <= after

    def test_user_unique_username(self, db_session):
        """Test that username must be unique."""
        user1 = User(username="duplicate", password_hash="hash1")
        db_session.add(user1)
        db_session.commit()

        user2 = User(username="duplicate", password_hash="hash2")
        db_session.add(user2)

        with pytest.raises(Exception):  # IntegrityError
            db_session.commit()

    def test_user_students_relationship(self, db_session, sample_departments):
        """Test User to Student relationship."""
        user = User(username="teacher", password_hash="hash")
        db_session.add(user)
        db_session.commit()

        student = Student(
            first_name="Test",
            last_name="Student",
            created_by_user_id=user.id
        )
        db_session.add(student)
        db_session.commit()

        db_session.refresh(user)
        assert len(user.students) == 1
        assert user.students[0].first_name == "Test"


class TestDepartmentModel:
    """Tests for Department model."""

    def test_create_department(self, db_session):
        """Test creating a new department."""
        dept = Department(
            name="Test Department",
            telegram_chat_id="-1001",
            active=True
        )
        db_session.add(dept)
        db_session.commit()
        db_session.refresh(dept)

        assert dept.id is not None
        assert dept.name == "Test Department"

    def test_department_default_active(self, db_session):
        """Test default active status for new department."""
        dept = Department(name="Test")
        db_session.add(dept)
        db_session.commit()
        db_session.refresh(dept)

        assert dept.active is True

    def test_department_unique_name(self, db_session):
        """Test that department name must be unique."""
        dept1 = Department(name="Duplicate")
        db_session.add(dept1)
        db_session.commit()

        dept2 = Department(name="Duplicate")
        db_session.add(dept2)

        with pytest.raises(Exception):  # IntegrityError
            db_session.commit()

    def test_department_students_relationship(self, db_session):
        """Test Department to Student relationship."""
        dept = Department(name="Test Dept")
        db_session.add(dept)
        db_session.commit()

        student = Student(
            first_name="Test",
            last_name="Student",
            department_id=dept.id
        )
        db_session.add(student)
        db_session.commit()

        db_session.refresh(dept)
        assert len(dept.students) == 1
        assert dept.students[0].first_name == "Test"


class TestStudentModel:
    """Tests for Student model."""

    def test_create_student_minimal(self, db_session):
        """Test creating a student with minimal data."""
        student = Student(
            first_name="Ahmet",
            last_name="Yılmaz"
        )
        db_session.add(student)
        db_session.commit()
        db_session.refresh(student)

        assert student.id is not None
        assert student.first_name == "Ahmet"
        assert student.last_name == "Yılmaz"

    def test_create_student_full(self, db_session, admin_user, sample_departments):
        """Test creating a student with all fields."""
        student = Student(
            first_name="Ahmet",
            last_name="Yılmaz",
            email="ahmet@example.com",
            phone="05321234567",
            high_school="İstanbul Lisesi",
            ranking=15000,
            yks_score=450.5,
            yks_type="SAYISAL",
            department_id=sample_departments[0].id,
            wants_tour=True,
            created_by_user_id=admin_user.id
        )
        db_session.add(student)
        db_session.commit()
        db_session.refresh(student)

        assert student.email == "ahmet@example.com"
        assert student.ranking == 15000
        assert student.yks_type == "SAYISAL"
        assert student.wants_tour is True

    def test_student_default_wants_tour(self, db_session):
        """Test default wants_tour value."""
        student = Student(
            first_name="Test",
            last_name="Student"
        )
        db_session.add(student)
        db_session.commit()
        db_session.refresh(student)

        assert student.wants_tour is False

    def test_student_timestamps(self, db_session):
        """Test student creation and update timestamps."""
        before = datetime.utcnow()
        student = Student(
            first_name="Test",
            last_name="Student"
        )
        db_session.add(student)
        db_session.commit()
        db_session.refresh(student)

        assert student.created_at is not None
        assert student.updated_at is not None
        assert before <= student.created_at

    def test_student_updated_at_changes(self, db_session):
        """Test that updated_at changes when record is modified."""
        student = Student(first_name="Test", last_name="Student")
        db_session.add(student)
        db_session.commit()

        original_updated_at = student.updated_at

        # Small delay to ensure timestamp difference
        import time
        time.sleep(0.01)

        student.first_name = "Updated"
        db_session.commit()
        db_session.refresh(student)

        assert student.updated_at > original_updated_at

    def test_student_relationships(self, db_session, admin_user, sample_departments):
        """Test student relationships to User and Department."""
        student = Student(
            first_name="Test",
            last_name="Student",
            department_id=sample_departments[0].id,
            created_by_user_id=admin_user.id
        )
        db_session.add(student)
        db_session.commit()

        db_session.refresh(student)
        assert student.created_by_user.username == admin_user.username
        assert student.department.name == sample_departments[0].name

    def test_student_nullable_fields(self, db_session):
        """Test that optional fields can be None."""
        student = Student(
            first_name="Test",
            last_name="Student"
        )
        db_session.add(student)
        db_session.commit()
        db_session.refresh(student)

        assert student.email is None
        assert student.phone is None
        assert student.high_school is None
        assert student.ranking is None
        assert student.yks_score is None
        assert student.yks_type is None
        assert student.department_id is None


class TestModelConstraints:
    """Tests for model constraints and validations."""

    def test_student_first_name_required(self, db_session):
        """Test that first_name is required."""
        student = Student(last_name="Yılmaz")
        db_session.add(student)

        with pytest.raises(Exception):
            db_session.commit()

    def test_student_last_name_required(self, db_session):
        """Test that last_name is required."""
        student = Student(first_name="Ahmet")
        db_session.add(student)

        with pytest.raises(Exception):
            db_session.commit()

    def test_user_username_required(self, db_session):
        """Test that username is required."""
        user = User(password_hash="hash")
        db_session.add(user)

        with pytest.raises(Exception):
            db_session.commit()

    def test_department_name_required(self, db_session):
        """Test that department name is required."""
        dept = Department()
        db_session.add(dept)

        with pytest.raises(Exception):
            db_session.commit()
