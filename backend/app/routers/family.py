"""
Human Legacy AI - Family Share & Public Portal Router

Provides user endpoints to configure family sharing and public endpoints for guests
to view memories and interact with the Cognitive Replica.
"""

from typing import Optional
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.middleware.auth_middleware import get_current_user
from app.schemas.family_podcast import (
    FamilyShareCreateRequest,
    FamilyShareUpdateRequest,
    FamilyShareResponse,
    PublicLegacyProfileResponse,
    PublicChatRequest,
    PublicChatResponse,
)
from app.services.family_podcast_service import (
    get_or_create_family_share,
    update_family_share,
    regenerate_family_share_token,
    get_public_legacy_profile,
    execute_public_family_chat,
)

router = APIRouter(tags=["Family Sharing"])


# =============================================================================
# Authenticated User Operations
# =============================================================================

@router.post(
    "/api/family-shares",
    response_model=FamilyShareResponse,
    status_code=status.HTTP_200_OK,
    summary="Get or generate secure family share link",
)
async def create_or_get_share_link(
    payload: Optional[FamilyShareCreateRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve existing family share link or generate a new secret token."""
    label = payload.label if payload else "Family & Loved Ones"
    allow_chat = payload.allow_chat if payload else True

    share = await get_or_create_family_share(
        db=db,
        user_id=current_user.id,
        label=label,
        allow_chat=allow_chat,
    )
    return FamilyShareResponse(
        id=share.id,
        share_token=share.share_token,
        label=share.label,
        is_active=share.is_active,
        allow_chat=share.allow_chat,
        views_count=share.views_count,
        created_at=share.created_at,
        share_url=f"/share/{share.share_token}",
    )


@router.get(
    "/api/family-shares",
    response_model=FamilyShareResponse,
    summary="Get user's current family share status",
)
async def get_my_family_share(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch current user's active family share link details."""
    share = await get_or_create_family_share(db=db, user_id=current_user.id)
    return FamilyShareResponse(
        id=share.id,
        share_token=share.share_token,
        label=share.label,
        is_active=share.is_active,
        allow_chat=share.allow_chat,
        views_count=share.views_count,
        created_at=share.created_at,
        share_url=f"/share/{share.share_token}",
    )


@router.put(
    "/api/family-shares/{share_token}",
    response_model=FamilyShareResponse,
    summary="Update family share settings or toggle active state",
)
async def update_share_settings(
    share_token: str,
    payload: FamilyShareUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update label, enable/disable link, or toggle chat permissions."""
    share = await update_family_share(
        db=db,
        user_id=current_user.id,
        share_token=share_token,
        label=payload.label,
        is_active=payload.is_active,
        allow_chat=payload.allow_chat,
    )
    return FamilyShareResponse(
        id=share.id,
        share_token=share.share_token,
        label=share.label,
        is_active=share.is_active,
        allow_chat=share.allow_chat,
        views_count=share.views_count,
        created_at=share.created_at,
        share_url=f"/share/{share.share_token}",
    )


@router.post(
    "/api/family-shares/{share_token}/regenerate",
    response_model=FamilyShareResponse,
    summary="Revoke existing token and issue a fresh share token",
)
async def regenerate_token(
    share_token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invalidates old link and generates a brand new token."""
    share = await regenerate_family_share_token(
        db=db,
        user_id=current_user.id,
        old_token=share_token,
    )
    return FamilyShareResponse(
        id=share.id,
        share_token=share.share_token,
        label=share.label,
        is_active=share.is_active,
        allow_chat=share.allow_chat,
        views_count=share.views_count,
        created_at=share.created_at,
        share_url=f"/share/{share.share_token}",
    )


# =============================================================================
# Public Endpoints (NO Auth Required for Family Guests)
# =============================================================================

@router.get(
    "/api/public/legacy/{share_token}",
    response_model=PublicLegacyProfileResponse,
    summary="Public tribute portal: view author's life timeline and milestones",
)
async def view_public_legacy(
    share_token: str,
    db: AsyncSession = Depends(get_db),
):
    """Public read-only tribute portal for family members."""
    return await get_public_legacy_profile(db=db, share_token=share_token)


@router.post(
    "/api/public/legacy/{share_token}/chat",
    response_model=PublicChatResponse,
    summary="Ask questions to the Cognitive Replica without an account",
)
async def chat_with_public_replica(
    share_token: str,
    payload: PublicChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Allows family members to chat with the author's replica using grounded memories."""
    return await execute_public_family_chat(
        db=db,
        share_token=share_token,
        question=payload.question,
        history=payload.history,
    )

