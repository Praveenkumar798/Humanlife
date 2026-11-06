"""
Human Legacy AI - Authentication Service

Handles secure password hashing using bcrypt, JWT token generation,
and user authentication logic.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
from jose import jwt, JWTError
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.config import settings
from app.models.user import User
from app.schemas.auth import UserRegisterRequest


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with automated salt generation."""
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(user_id: uuid.UUID) -> str:
    """Create a signed JWT access token encoding the user's UUID."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token. Returns payload or None."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


async def register_user(db: AsyncSession, data: UserRegisterRequest) -> User:
    """Register a new user account after checking uniqueness of email and username."""
    # Check if user with same email or username already exists
    stmt = select(User).where(
        or_(
            User.email == data.email.lower(),
            User.username == data.username.lower()
        )
    )
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        if existing_user.email.lower() == data.email.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This username is already taken."
            )

    # Hash the password securely with bcrypt
    hashed = hash_password(data.password)

    user = User(
        email=data.email.lower(),
        username=data.username.lower(),
        hashed_password=hashed,
        full_name=data.full_name,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(
    db: AsyncSession,
    email_or_username: str,
    password: str
) -> Optional[User]:
    """Verify user credentials by email or username and verify password."""
    identifier = email_or_username.lower().strip()
    stmt = select(User).where(
        or_(
            User.email == identifier,
            User.username == identifier
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    return user


async def authenticate_google_user(
    db: AsyncSession,
    credential: str
) -> User:
    """
    Authenticate or auto-register a user via Google One-Tap / Social Auth.
    Verifies the Google ID token via Google's tokeninfo API.
    """
    import httpx
    import secrets

    # Verify ID token with Google's official endpoint
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": credential}
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired Google authentication credential."
                )
            payload = resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to verify Google credentials with Google servers: {str(e)}"
        )

    email = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account does not provide an email address."
        )

    email_lower = email.lower().strip()
    full_name = payload.get("name")

    # Check if user already exists by email
    stmt = select(User).where(User.email == email_lower)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deactivated."
            )
        # Update full name if missing
        if not user.full_name and full_name:
            user.full_name = full_name
            await db.commit()
            await db.refresh(user)
        return user

    # Otherwise auto-create new user
    base_name = email_lower.split("@")[0]
    clean_username = "".join(c for c in base_name if c.isalnum() or c in ("_", "-"))[:25]
    if len(clean_username) < 3:
        clean_username = f"user_{secrets.token_hex(4)}"

    # Ensure uniqueness of username
    stmt_check = select(User).where(User.username == clean_username)
    res_check = await db.execute(stmt_check)
    if res_check.scalar_one_or_none():
        clean_username = f"{clean_username[:18]}_{secrets.token_hex(3)}"

    # Random high-entropy unguessable password
    random_pwd = secrets.token_urlsafe(32)
    new_user = User(
        email=email_lower,
        username=clean_username,
        full_name=full_name or clean_username,
        hashed_password=hash_password(random_pwd),
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


