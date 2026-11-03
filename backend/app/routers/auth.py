"""
Human Legacy AI - Authentication Router

Provides endpoints for user registration, login, logout, and profile verification.
All authentication tokens are transmitted exclusively via secure httpOnly cookies.
"""

from fastapi import APIRouter, Depends, Response, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    MessageResponse,
)
from app.services.auth_service import (
    register_user,
    authenticate_user,
    create_access_token,
)
from app.middleware.auth_middleware import (
    get_current_user,
    set_auth_cookie,
    clear_auth_cookie,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account"
)
async def register(
    data: UserRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user account.
    Upon successful registration, sets a secure httpOnly cookie with a JWT
    and returns the public user profile.
    """
    user = await register_user(db, data)
    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return user


@router.post(
    "/login",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Log into an existing user account"
)
async def login(
    data: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Log into an existing user account with email/username and password.
    Sets a secure httpOnly cookie containing the access token.
    """
    user = await authenticate_user(db, data.email_or_username, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password.",
            headers={"WWW-Authenticate": "Cookie"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return user


@router.post(
    "/logout",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Log out and clear session cookie"
)
async def logout(response: Response):
    """
    Log out the current user session by clearing the httpOnly authentication cookie.
    """
    clear_auth_cookie(response)
    return MessageResponse(message="Logged out successfully.")


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile"
)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Retrieve the profile of the currently authenticated user from the active session.
    Protected route - requires valid httpOnly cookie.
    """
    return current_user

