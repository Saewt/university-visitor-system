"""
Tests for Pydantic schemas and validation.
"""
import pytest
from datetime import datetime
from decimal import Decimal
from pydantic import ValidationError


class TestStudentSchemas:
    """Tests for Student-related schemas."""

    def test_student_create_valid(self):
        """Test creating a valid StudentCreate schema."""
        from app.schemas import StudentCreate

        student = StudentCreate(
            first_name="Ahmet",
            last_name="Yılmaz",
            email="ahmet@example.com",
            phone="05321234567",
            ranking=15000,
            yks_score=450.5,
            yks_type="SAYISAL"
        )
        assert student.first_name == "Ahmet"
        assert student.last_name == "Yılmaz"
        assert student.email == "ahmet@example.com"

    def test_student_create_minimal(self):
        """Test StudentCreate with only required fields."""
        from app.schemas import StudentCreate

        student = StudentCreate(
            first_name="Ahmet",
            last_name="Yılmaz"
        )
        assert student.first_name == "Ahmet"
        assert student.last_name == "Yılmaz"
        assert student.wants_tour is False  # Default value

    def test_student_create_empty_email(self):
        """Test that empty string email is allowed."""
        from app.schemas import StudentCreate

        student = StudentCreate(
            first_name="Ahmet",
            last_name="Yılmaz",
            email=""
        )
        assert student.email == ""

    def test_student_create_invalid_email(self):
        """Test validation of invalid email format."""
        from app.schemas import StudentCreate

        with pytest.raises(ValidationError) as exc_info:
            StudentCreate(
                first_name="Ahmet",
                last_name="Yılmaz",
                email="invalid-email"
            )
        assert "Invalid email format" in str(exc_info.value)

    def test_student_create_invalid_yks_type(self):
        """Test validation of invalid YKS type."""
        from app.schemas import StudentCreate

        with pytest.raises(ValidationError) as exc_info:
            StudentCreate(
                first_name="Ahmet",
                last_name="Yılmaz",
                yks_type="INVALID"
            )
        assert "YKS type must be one of" in str(exc_info.value)

    def test_student_create_valid_yks_types(self):
        """Test all valid YKS types."""
        from app.schemas import StudentCreate

        for yks_type in ["SAYISAL", "SOZEL", "EA", "DIL"]:
            student = StudentCreate(
                first_name="Ahmet",
                last_name="Yılmaz",
                yks_type=yks_type
            )
            assert student.yks_type == yks_type

    def test_student_create_negative_ranking(self):
        """Test validation of negative ranking."""
        from app.schemas import StudentCreate

        with pytest.raises(ValidationError):
            StudentCreate(
                first_name="Ahmet",
                last_name="Yılmaz",
                ranking=-1
            )

    def test_student_create_invalid_yks_score_low(self):
        """Test validation of YKS score below minimum."""
        from app.schemas import StudentCreate

        with pytest.raises(ValidationError):
            StudentCreate(
                first_name="Ahmet",
                last_name="Yılmaz",
                yks_score=-1
            )

    def test_student_create_invalid_yks_score_high(self):
        """Test validation of YKS score above maximum."""
        from app.schemas import StudentCreate

        with pytest.raises(ValidationError):
            StudentCreate(
                first_name="Ahmet",
                last_name="Yılmaz",
                yks_score=601
            )

    def test_student_create_name_too_long(self):
        """Test validation of name length."""
        from app.schemas import StudentCreate

        with pytest.raises(ValidationError):
            StudentCreate(
                first_name="A" * 101,
                last_name="Yılmaz"
            )

    def test_student_create_empty_name(self):
        """Test validation of empty name."""
        from app.schemas import StudentCreate

        with pytest.raises(ValidationError):
            StudentCreate(
                first_name="",
                last_name="Yılmaz"
            )

    def test_student_update_partial(self):
        """Test StudentUpdate with partial data."""
        from app.schemas import StudentUpdate

        update = StudentUpdate(ranking=10000)
        assert update.ranking == 10000
        assert update.first_name is None  # Not provided

    def test_student_update_empty_email_becomes_empty_string(self):
        """Test that None email becomes empty string."""
        from app.schemas import StudentUpdate

        update = StudentUpdate(email=None)
        assert update.email == ""


class TestUserSchemas:
    """Tests for User-related schemas."""

    def test_user_create_valid(self):
        """Test creating a valid UserCreate schema."""
        from app.schemas import UserCreate

        user = UserCreate(
            username="testuser",
            password="password123",
            role="teacher"
        )
        assert user.username == "testuser"
        assert user.role == "teacher"

    def test_user_create_default_role(self):
        """Test default role for UserCreate."""
        from app.schemas import UserCreate

        user = UserCreate(
            username="testuser",
            password="password123"
        )
        assert user.role == "teacher"


class TestDepartmentSchemas:
    """Tests for Department-related schemas."""

    def test_department_create_valid(self):
        """Test creating a valid DepartmentCreate schema."""
        from app.schemas import DepartmentCreate

        dept = DepartmentCreate(
            name="Test Department",
            telegram_chat_id="-1001",
            active=True
        )
        assert dept.name == "Test Department"
        assert dept.telegram_chat_id == "-1001"
        assert dept.active is True

    def test_department_create_minimal(self):
        """Test DepartmentCreate with minimal data."""
        from app.schemas import DepartmentCreate

        dept = DepartmentCreate(name="Test Department")
        assert dept.name == "Test Department"
        assert dept.active is True  # Default
        assert dept.telegram_chat_id is None  # Default


class TestStatsSchemas:
    """Tests for Stats-related schemas."""

    def test_stats_summary_valid(self):
        """Test creating a valid StatsSummary schema."""
        from app.schemas import StatsSummary

        stats = StatsSummary(
            total_students=100,
            today_count=10,
            tour_requests=25,
            unique_departments=8
        )
        assert stats.total_students == 100
        assert stats.tour_requests == 25

    def test_department_stats_valid(self):
        """Test creating a valid DepartmentStats schema."""
        from app.schemas import DepartmentStats

        dept_stat = DepartmentStats(
            department_name="Tıp",
            count=25
        )
        assert dept_stat.department_name == "Tıp"
        assert dept_stat.count == 25

    def test_yks_type_stats_valid(self):
        """Test creating a valid YksTypeStats schema."""
        from app.schemas import YksTypeStats

        yks_stat = YksTypeStats(
            yks_type="SAYISAL",
            count=45
        )
        assert yks_stat.yks_type == "SAYISAL"
        assert yks_stat.count == 45

    def test_tour_request_stats_valid(self):
        """Test creating a valid TourRequestStats schema."""
        from app.schemas import TourRequestStats

        tour_stat = TourRequestStats(
            department_name="Tıp",
            tour_requests=10,
            total_students=25
        )
        assert tour_stat.tour_requests == 10
        assert tour_stat.total_students == 25

    def test_hourly_stats_valid(self):
        """Test creating a valid HourlyStats schema."""
        from app.schemas import HourlyStats

        hourly = HourlyStats(hour=14, count=5)
        assert hourly.hour == 14
        assert hourly.count == 5

    def test_teacher_stats_valid(self):
        """Test creating a valid TeacherStats schema."""
        from app.schemas import TeacherStats

        teacher_stat = TeacherStats(
            user_id=1,
            username="teacher1",
            count=50,
            today_count=5
        )
        assert teacher_stat.user_id == 1
        assert teacher_stat.today_count == 5


class TestSSEEventSchema:
    """Tests for SSE Event schema."""

    def test_sse_event_valid(self):
        """Test creating a valid SSEEvent schema."""
        from app.schemas import SSEEvent

        event = SSEEvent(
            type="student_created",
            data={"id": 1, "name": "Test"}
        )
        assert event.type == "student_created"
        assert event.data == {"id": 1, "name": "Test"}


class TestExportParamsSchema:
    """Tests for Export parameters schema."""

    def test_export_params_empty(self):
        """Test ExportParams with no filters."""
        from app.schemas import ExportParams

        params = ExportParams()
        assert params.start_date is None
        assert params.end_date is None
        assert params.department_id is None

    def test_export_params_with_filters(self):
        """Test ExportParams with date and department filters."""
        from app.schemas import ExportParams
        from datetime import datetime

        start = datetime(2024, 1, 1)
        end = datetime(2024, 12, 31)

        params = ExportParams(
            start_date=start,
            end_date=end,
            department_id=1
        )
        assert params.start_date == start
        assert params.end_date == end
        assert params.department_id == 1
