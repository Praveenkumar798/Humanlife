"""
Human Legacy AI - Authentication Middleware & Dependencies

Extracts and validates JWT tokens from httpOnly cookies on protected routes.
Provides cookie helper functions with secure production flags.
"""

import uuid
import inspect
from typing import Optional
from fastapi import Request, Response, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.auth_service import decode_access_token

COOKIE_NAME = "access_token"


def set_auth_cookie(response: Response, token: str) -> None:
    """
    Set the JWT in a secure httpOnly cookie.
    Prevents XSS attacks from reading the authentication token.
    """
    is_production = settings.APP_ENV.lower() == "production"
    max_age_seconds = settings.JWT_EXPIRATION_MINUTES * 60

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=max_age_seconds,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """Clear the httpOnly authentication cookie upon logout."""
    is_production = settings.APP_ENV.lower() == "production"
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        httponly=True,
        secure=is_production,
        samesite="lax",
    )


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    FastAPI dependency that extracts the JWT token from the httpOnly cookie,
    decodes it, and retrieves the authenticated User from the database.
    Raises 401 Unauthorized if invalid or absent.
    """
    token: Optional[str] = request.cookies.get(COOKIE_NAME)

    # Optional fallback for header Authorization: Bearer <token>
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Cookie"},
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please log in again.",
            headers={"WWW-Authenticate": "Cookie"},
        )

    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token payload.",
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if inspect.isawaitable(user):
        user = await user

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated.",
        )

    return user

