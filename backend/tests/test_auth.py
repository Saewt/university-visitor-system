"""
Tests for authentication endpoints and functionality.
"""
import pytest
from fastapi import status
from datetime import datetime, timedelta


class TestLogin:
    """Tests for POST /api/auth/login"""

    def test_login_success(self, client, admin_user):
        """Test successful login with valid credentials."""
        response = client.post("/api/auth/login", json={
            "username": "testadmin",
            "password": "admin123"
        })
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == "testadmin"
        assert data["user"]["role"] == "admin"

    def test_login_invalid_username(self, client, admin_user):
        """Test login with non-existent username."""
        response = client.post("/api/auth/login", json={
            "username": "nonexistent",
            "password": "password123"
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid username or password" in response.json()["detail"]

    def test_login_invalid_password(self, client, admin_user):
        """Test login with invalid password."""
        response = client.post("/api/auth/login", json={
            "username": "testadmin",
            "password": "wrongpassword"
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid username or password" in response.json()["detail"]

    def test_login_missing_fields(self, client):
        """Test login with missing required fields."""
        response = client.post("/api/auth/login", json={
            "username": "testadmin"
        })
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestLogout:
    """Tests for POST /api/auth/logout"""

    def test_logout(self, client, admin_headers):
        """Test logout endpoint."""
        response = client.post("/api/auth/logout", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["message"] == "Successfully logged out"


class TestGetMe:
    """Tests for GET /api/auth/me"""

    def test_get_me_authenticated(self, client, admin_headers, admin_user):
        """Test getting current user info when authenticated."""
        response = client.get("/api/auth/me", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == admin_user.username
        assert data["role"] == admin_user.role
        assert data["id"] == admin_user.id

    def test_get_me_unauthorized(self, client):
        """Test getting current user info without authentication."""
        response = client.get("/api/auth/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_me_invalid_token(self, client):
        """Test getting current user info with invalid token."""
        response = client.get("/api/auth/me", headers={
            "Authorization": "Bearer invalid_token"
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestRegister:
    """Tests for POST /api/auth/register"""

    def test_register_new_user(self, client, admin_headers):
        """Test registering a new user."""
        response = client.post("/api/auth/register", json={
            "username": "newteacher",
            "password": "password123",
            "role": "teacher"
        }, headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == "newteacher"
        assert data["role"] == "teacher"
        assert "id" in data
        assert "password" not in data  # Password should not be returned

    def test_register_duplicate_username(self, client, admin_headers, admin_user):
        """Test registering with an existing username."""
        response = client.post("/api/auth/register", json={
            "username": "testadmin",
            "password": "password123",
            "role": "teacher"
        }, headers=admin_headers)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Username already exists" in response.json()["detail"]

    def test_register_unauthorized(self, client):
        """Test registering without authentication."""
        response = client.post("/api/auth/register", json={
            "username": "newuser",
            "password": "password123"
        })
        # This should return 401 because auth is required
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


class TestPasswordHashing:
    """Tests for password hashing functionality."""

    def test_password_hash_is_not_plain_text(self, admin_user):
        """Test that passwords are hashed, not stored as plain text."""
        assert admin_user.password_hash != "admin123"
        # Bcrypt hashes start with $2b$
        assert admin_user.password_hash.startswith("$2b$")

    def test_verify_password(self, admin_user):
        """Test password verification."""
        from app.routers.auth import verify_password
        assert verify_password("admin123", admin_user.password_hash) is True
        assert verify_password("wrongpassword", admin_user.password_hash) is False


class TestTokenGeneration:
    """Tests for JWT token generation."""

    def test_token_contains_required_claims(self, admin_token):
        """Test that token contains required claims."""
        from jose import jwt
        from app.config import get_settings

        settings = get_settings()
        decoded = jwt.decode(
            admin_token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )
        assert "sub" in decoded
        assert "user_id" in decoded
        assert "role" in decoded
        assert "exp" in decoded

    def test_token_expiration(self, admin_user):
        """Test that token has correct expiration time."""
        from datetime import timedelta
        from app.routers.auth import create_access_token
        from jose import jwt
        from app.config import get_settings

        settings = get_settings()
        token = create_access_token(
            data={"sub": admin_user.username, "user_id": admin_user.id, "role": admin_user.role}
        )
        decoded = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )

        exp_time = decoded["exp"]
        current_time = int((datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)).timestamp())

        # Allow 5 second tolerance
        assert abs(exp_time - current_time) < 5
