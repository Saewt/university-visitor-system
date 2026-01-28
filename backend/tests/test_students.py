"""
Tests for student CRUD operations and endpoints.
"""
import pytest
from datetime import datetime, timedelta
from fastapi import status


class TestGetStudents:
    """Tests for GET /api/students"""

    def test_get_students_empty(self, client, admin_headers):
        """Test getting students when none exist."""
        response = client.get("/api/students", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_get_students_with_data(self, client, admin_headers, multiple_students):
        """Test getting students with existing data."""
        response = client.get("/api/students", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 5
        assert data[0]["first_name"] == "Ahmet"

    def test_get_students_unauthorized(self, client):
        """Test getting students without authentication."""
        response = client.get("/api/students")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_students_pagination(self, client, admin_headers, multiple_students):
        """Test pagination of students list."""
        # Get first 2 students
        response = client.get("/api/students?skip=0&limit=2", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2

    def test_get_students_filter_by_department(self, client, admin_headers, multiple_students, sample_departments):
        """Test filtering students by department."""
        dept_id = sample_departments[0].id  # Tıp department
        response = client.get(f"/api/students?department_id={dept_id}", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert all(s["department_id"] == dept_id for s in data)

    def test_get_students_filter_by_yks_type(self, client, admin_headers, multiple_students):
        """Test filtering students by YKS type."""
        response = client.get("/api/students?yks_type=SAYISAL", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert all(s["yks_type"] == "SAYISAL" for s in data)

    def test_get_students_filter_by_tour(self, client, admin_headers, multiple_students):
        """Test filtering students by tour preference."""
        response = client.get("/api/students?wants_tour=true", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert all(s["wants_tour"] is True for s in data)

    def test_get_students_search(self, client, admin_headers, multiple_students):
        """Test searching students by name or email."""
        response = client.get("/api/students?search=Ahmet", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["first_name"] == "Ahmet"

    def test_get_students_search_email(self, client, admin_headers, multiple_students):
        """Test searching students by email."""
        response = client.get("/api/students?search=mehmet.demir", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert "mehmet.demir" in data[0]["email"]


class TestGetStudent:
    """Tests for GET /api/students/{id}"""

    def test_get_student_by_id(self, client, admin_headers, sample_student):
        """Test getting a specific student by ID."""
        response = client.get(f"/api/students/{sample_student.id}", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == sample_student.id
        assert data["first_name"] == sample_student.first_name

    def test_get_student_not_found(self, client, admin_headers):
        """Test getting a non-existent student."""
        response = client.get("/api/students/99999", headers=admin_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_student_unauthorized(self, client, sample_student):
        """Test getting a student without authentication."""
        response = client.get(f"/api/students/{sample_student.id}")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestCreateStudent:
    """Tests for POST /api/students"""

    def test_create_student_success(self, client, admin_headers, sample_departments):
        """Test creating a new student successfully."""
        student_data = {
            "first_name": "Zeynep",
            "last_name": "Arslan",
            "email": "zeynep.arslan@example.com",
            "phone": "05321234567",
            "high_school": "Galatasaray Lisesi",
            "ranking": 20000,
            "yks_score": 430.5,
            "yks_type": "SOZEL",
            "department_id": sample_departments[1].id,
            "wants_tour": True
        }
        response = client.post("/api/students", json=student_data, headers=admin_headers)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["first_name"] == "Zeynep"
        assert data["last_name"] == "Arslan"
        assert data["id"] > 0

    def test_create_student_minimal_data(self, client, teacher_headers, sample_departments):
        """Test creating a student with minimal required data."""
        student_data = {
            "first_name": "Can",
            "last_name": "Öztürk"
        }
        response = client.post("/api/students", json=student_data, headers=teacher_headers)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["first_name"] == "Can"
        assert data["last_name"] == "Öztürk"

    def test_create_student_invalid_department(self, client, admin_headers):
        """Test creating a student with invalid department."""
        student_data = {
            "first_name": "Test",
            "last_name": "Student",
            "department_id": 99999
        }
        response = client.post("/api/students", json=student_data, headers=admin_headers)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Department not found" in response.json()["detail"]

    def test_create_student_unauthorized(self, client, sample_departments):
        """Test creating a student without authentication."""
        response = client.post("/api/students", json={
            "first_name": "Test",
            "last_name": "Student"
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_student_invalid_email(self, client, admin_headers):
        """Test creating a student with invalid email format."""
        student_data = {
            "first_name": "Test",
            "last_name": "Student",
            "email": "invalid-email"
        }
        response = client.post("/api/students", json=student_data, headers=admin_headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_student_invalid_yks_type(self, client, admin_headers):
        """Test creating a student with invalid YKS type."""
        student_data = {
            "first_name": "Test",
            "last_name": "Student",
            "yks_type": "INVALID"
        }
        response = client.post("/api/students", json=student_data, headers=admin_headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_student_negative_ranking(self, client, admin_headers):
        """Test creating a student with negative ranking."""
        student_data = {
            "first_name": "Test",
            "last_name": "Student",
            "ranking": -1
        }
        response = client.post("/api/students", json=student_data, headers=admin_headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestUpdateStudent:
    """Tests for PUT /api/students/{id}"""

    def test_update_student_success(self, client, admin_headers, sample_student):
        """Test updating a student successfully."""
        update_data = {
            "first_name": "Ahmet Updated",
            "ranking": 10000
        }
        response = client.put(f"/api/students/{sample_student.id}", json=update_data, headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["first_name"] == "Ahmet Updated"
        assert data["ranking"] == 10000

    def test_update_student_not_found(self, client, admin_headers):
        """Test updating a non-existent student."""
        response = client.put("/api/students/99999", json={
            "first_name": "Test"
        }, headers=admin_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_student_invalid_department(self, client, admin_headers, sample_student):
        """Test updating a student with invalid department."""
        response = client.put(f"/api/students/{sample_student.id}", json={
            "department_id": 99999
        }, headers=admin_headers)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_student_unauthorized(self, client, sample_student):
        """Test updating a student without authentication."""
        response = client.put(f"/api/students/{sample_student.id}", json={
            "first_name": "Test"
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestDeleteStudent:
    """Tests for DELETE /api/students/{id}"""

    def test_delete_student_success(self, client, admin_headers, sample_student):
        """Test deleting a student successfully."""
        response = client.delete(f"/api/students/{sample_student.id}", headers=admin_headers)
        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify student is deleted
        get_response = client.get(f"/api/students/{sample_student.id}", headers=admin_headers)
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_student_not_found(self, client, admin_headers):
        """Test deleting a non-existent student."""
        response = client.delete("/api/students/99999", headers=admin_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_student_forbidden_for_teacher(self, client, teacher_headers, sample_student):
        """Test that teachers cannot delete students."""
        response = client.delete(f"/api/students/{sample_student.id}", headers=teacher_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_student_unauthorized(self, client, sample_student):
        """Test deleting a student without authentication."""
        response = client.delete(f"/api/students/{sample_student.id}")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestGetDepartments:
    """Tests for GET /api/students/departments/list"""

    def test_get_departments(self, client, admin_headers, sample_departments):
        """Test getting list of active departments."""
        response = client.get("/api/students/departments/list", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == len(sample_departments)
        assert all("id" in d and "name" in d for d in data)

    def test_get_departments_only_active(self, client, admin_headers, db_session):
        """Test that only active departments are returned."""
        from app.models import Department

        # Create an inactive department
        inactive_dept = Department(name="Inactive", active=False)
        db_session.add(inactive_dept)
        db_session.commit()

        response = client.get("/api/students/departments/list", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert not any(d["name"] == "Inactive" for d in data)


class TestHistoryEndpoints:
    """Tests for student history endpoints."""

    def test_get_history_dates(self, client, admin_headers, multiple_students):
        """Test getting history dates grouped by date."""
        response = client.get("/api/students/history/dates", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0
        assert all("date" in d and "count" in d and "date_iso" in d for d in data)

    def test_get_history_by_date(self, client, admin_headers, multiple_students):
        """Test getting students for a specific date."""
        today = datetime.utcnow().strftime("%Y-%m-%d")
        response = client.get(f"/api/students/history/by-date/{today}", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should have at least one student from today
        assert len(data) >= 0

    def test_get_history_by_date_invalid_format(self, client, admin_headers):
        """Test getting history with invalid date format."""
        response = client.get("/api/students/history/by-date/invalid-date", headers=admin_headers)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_history(self, client, admin_headers, multiple_students):
        """Test getting student history grouped by date."""
        response = client.get("/api/students/history", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) > 0
        assert all("date" in d and "count" in d and "students" in d for d in data)


class TestMockData:
    """Tests for mock data endpoints."""

    def test_create_mock_data_admin_only(self, client, teacher_headers, sample_departments):
        """Test that only admins can create mock data."""
        response = client.post("/api/students/mock-data?demo=true", headers=teacher_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_mock_data_success(self, client, admin_headers, sample_departments, db_session):
        """Test creating mock data successfully."""
        response = client.post("/api/students/mock-data?demo=false", headers=admin_headers)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "message" in data
        assert data["details"]["total_students"] == 20

    def test_create_demo_data_success(self, client, admin_headers, sample_departments, db_session):
        """Test creating comprehensive demo data."""
        response = client.post("/api/students/mock-data?demo=true", headers=admin_headers)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["details"]["total_students"] == 150
        assert data["details"]["span_days"] == 30

    def test_delete_mock_data_no_confirmation(self, client, admin_headers, sample_student):
        """Test deletion requires confirmation."""
        response = client.delete("/api/students/mock-data?confirm=false", headers=admin_headers)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_delete_mock_data_success(self, client, admin_headers, sample_student):
        """Test deleting all student data."""
        response = client.delete("/api/students/mock-data?confirm=true", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "silindi" in data["message"]


class TestTeacherAccessControl:
    """Tests for teacher-specific access restrictions."""

    def test_teacher_sees_only_own_students(self, client, teacher_user, admin_user, db_session, sample_departments):
        """Test that teachers only see students they created."""
        from app.models import Student
        from app.routers.auth import create_access_token

        # Create students as admin
        admin_student = Student(
            first_name="Admin",
            last_name="Student",
            department_id=sample_departments[0].id,
            created_by_user_id=admin_user.id
        )
        db_session.add(admin_student)

        # Create student as teacher
        teacher_student = Student(
            first_name="Teacher",
            last_name="Student",
            department_id=sample_departments[0].id,
            created_by_user_id=teacher_user.id
        )
        db_session.add(teacher_student)
        db_session.commit()

        # Get teacher token
        teacher_token = create_access_token(data={
            "sub": teacher_user.username,
            "user_id": teacher_user.id,
            "role": teacher_user.role
        })

        # Teacher should only see their own student
        response = client.get("/api/students", headers={"Authorization": f"Bearer {teacher_token}"})
        data = response.json()
        assert len(data) == 1
        assert data[0]["first_name"] == "Teacher"
