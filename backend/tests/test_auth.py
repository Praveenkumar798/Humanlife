"""
Unit and Integration Tests for Stage 3 Authentication

Tests password hashing, JWT encoding/decoding, cookie settings,
user registration, login, logout, and protected route access.
"""

import uuid
import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi import Response, Request, HTTPException

from app.models.user import User
from app.schemas.auth import UserRegisterRequest, UserLoginRequest
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)
from app.middleware.auth_middleware import (
    set_auth_cookie,
    clear_auth_cookie,
    get_current_user,
    COOKIE_NAME,
)
from app.routers.auth import register, login, logout, get_me


def test_password_hashing_and_verification():
    """Verify that bcrypt hashes passwords securely and verifies them correctly."""
    password = "MySecurePassword2026!"
    hashed = hash_password(password)

    # Must be a bcrypt hash (starts with $2b$)
    assert hashed.startswith("$2b$")
    assert hashed != password

    # Correct password verifies
    assert verify_password(password, hashed) is True

    # Wrong password fails verification
    assert verify_password("WrongPassword123!", hashed) is False
    assert verify_password("", hashed) is False


def test_jwt_token_lifecycle():
    """Verify JWT creation, payload encoding, and tamper rejection."""
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    assert isinstance(token, str)
    assert len(token) > 20

    # Decode valid token
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == str(user_id)
    assert "exp" in payload

    # Tampered token must fail decoding
    tampered_token = token[:-5] + "XXXXX"
    assert decode_access_token(tampered_token) is None
    assert decode_access_token("completely.invalid.token") is None


def test_auth_cookie_helpers():
    """Verify cookie helpers set httpOnly and correct expiration attributes."""
    response = Response()
    token = "sample.jwt.token"
    set_auth_cookie(response, token)

    # Inspect Set-Cookie header in response
    cookie_header = response.headers.get("set-cookie")
    assert cookie_header is not None
    assert f"{COOKIE_NAME}={token}" in cookie_header
    assert "HttpOnly" in cookie_header or "httponly" in cookie_header.lower()
    assert "samesite=lax" in cookie_header.lower()

    # Clear cookie
    clear_response = Response()
    clear_auth_cookie(clear_response)
    clear_header = clear_response.headers.get("set-cookie")
    assert clear_header is not None
    assert COOKIE_NAME in clear_header
    assert 'max-age=0' in clear_header.lower() or 'expires=' in clear_header.lower()


def test_register_endpoint():
    """Test user registration endpoint sets cookie and returns public profile."""
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    # Mock no existing user
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    req_data = UserRegisterRequest(
        email="newuser@example.com",
        username="newuser",
        password="securepassword123",
        full_name="New User",
    )
    response = Response()

    user = asyncio.run(register(data=req_data, response=response, db=mock_db))

    assert user.email == "newuser@example.com"
    assert user.username == "newuser"
    assert user.full_name == "New User"
    assert user.is_active is True

    # Check that httpOnly cookie was set in response
    set_cookie = response.headers.get("set-cookie")
    assert set_cookie is not None
    assert COOKIE_NAME in set_cookie
    assert "httponly" in set_cookie.lower()


def test_register_duplicate_email():
    """Test registration fails with 409 if email or username is already taken."""
    mock_db = AsyncMock()
    existing_user = User(
        email="existing@example.com",
        username="existinguser",
        hashed_password=hash_password("password123"),
        is_active=True,
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_user
    mock_db.execute.return_value = mock_result

    req_data = UserRegisterRequest(
        email="existing@example.com",
        username="differentname",
        password="securepassword123",
    )
    response = Response()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(register(data=req_data, response=response, db=mock_db))

    assert exc_info.value.status_code == 409
    assert "already exists" in exc_info.value.detail


def test_login_success():
    """Test login with valid credentials sets cookie and returns user."""
    mock_db = AsyncMock()
    hashed = hash_password("mypassword123")
    user = User(
        email="user@example.com",
        username="myuser",
        hashed_password=hashed,
        is_active=True,
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = user
    mock_db.execute.return_value = mock_result

    req_data = UserLoginRequest(
        email_or_username="user@example.com",
        password="mypassword123",
    )
    response = Response()

    logged_in_user = asyncio.run(login(data=req_data, response=response, db=mock_db))
    assert logged_in_user.email == "user@example.com"

    # Verify cookie was attached
    set_cookie = response.headers.get("set-cookie")
    assert set_cookie is not None
    assert COOKIE_NAME in set_cookie
    assert "httponly" in set_cookie.lower()


def test_login_invalid_password():
    """Test login with wrong password raises 401 Unauthorized."""
    mock_db = AsyncMock()
    hashed = hash_password("correctpassword")
    user = User(
        email="user@example.com",
        username="myuser",
        hashed_password=hashed,
        is_active=True,
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = user
    mock_db.execute.return_value = mock_result

    req_data = UserLoginRequest(
        email_or_username="user@example.com",
        password="wrongpassword!",
    )
    response = Response()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(login(data=req_data, response=response, db=mock_db))

    assert exc_info.value.status_code == 401
    assert "Incorrect" in exc_info.value.detail


def test_logout_endpoint():
    """Test logout clears the cookie."""
    response = Response()
    msg = asyncio.run(logout(response=response))
    assert msg.message == "Logged out successfully."

    set_cookie = response.headers.get("set-cookie")
    assert set_cookie is not None
    assert COOKIE_NAME in set_cookie


def test_get_current_user_valid_cookie():
    """Test get_current_user resolves the user when given a valid cookie."""
    user_id = uuid.uuid4()
    token = create_access_token(user_id)

    mock_request = MagicMock(spec=Request)
    mock_request.cookies = {COOKIE_NAME: token}
    mock_request.headers = {}

    expected_user = User(
        id=user_id,
        email="verified@example.com",
        username="verified",
        hashed_password="...",
        is_active=True,
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = expected_user
    mock_db.execute.return_value = mock_result

    user = asyncio.run(get_current_user(request=mock_request, db=mock_db))
    assert user.id == user_id
    assert user.email == "verified@example.com"


def test_get_current_user_missing_cookie():
    """Test get_current_user raises 401 when no token is provided."""
    mock_request = MagicMock(spec=Request)
    mock_request.cookies = {}
    mock_request.headers = {}

    mock_db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_current_user(request=mock_request, db=mock_db))

    assert exc_info.value.status_code == 401
    assert "Authentication required" in exc_info.value.detail


def test_get_me_endpoint():
    """Test /api/auth/me returns the injected current user."""
    current_user = User(
        email="me@example.com",
        username="meuser",
        hashed_password="...",
        is_active=True,
    )
    result = asyncio.run(get_me(current_user=current_user))
    assert result.email == "me@example.com"
    assert result.username == "meuser"
