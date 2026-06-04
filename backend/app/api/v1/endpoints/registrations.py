from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_current_user
from app.db.session import get_db
from app.models.ownership_history import OwnershipHistory
from app.models.registration import Registration
from app.models.star import Star
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.registration import (
    RegistrationAccountRead,
    RegistrationClaimPreviewRead,
    RegistrationClaimResult,
    RegistrationPublicRead,
)
from app.services.registration_records import build_claim_token, parse_claim_token
from app.api.v1.endpoints.stars import build_star_detail_response


router = APIRouter()


def _frontend_public_url(slug: str) -> str:
    return f"/starwiki/{slug}"


def _frontend_claim_url(registration: Registration) -> str | None:
    if registration.is_gift and registration.claim_status == "claimable":
        return f"/claim/{build_claim_token(registration.id)}"
    if registration.claim_status == "claimable":
        return f"/claim/{build_claim_token(registration.id)}"
    return None


def _can_access_registration(current_user: User, registration: Registration) -> bool:
    if current_user.id == registration.current_holder_user_id:
        return True
    return current_user.id == registration.purchaser_user_id and registration.claim_status == "claimable"


async def _load_registration_with_star(db: AsyncSession, *, registration_id: int | None = None, slug: str | None = None):
    query = select(Registration, Star).join(Star, Star.id == Registration.star_id)
    if registration_id is not None:
        query = query.where(Registration.id == registration_id)
    if slug is not None:
        query = query.where(Registration.public_page_slug == slug)
    result = await db.execute(query)
    return result.first()


async def _load_usernames(db: AsyncSession, *user_ids: int | None) -> dict[int, str]:
    normalized = [user_id for user_id in user_ids if user_id is not None]
    if not normalized:
        return {}

    result = await db.execute(select(User.id, User.username).where(User.id.in_(normalized)))
    return {user_id: username for user_id, username in result.all() if username}


@router.get("/public/{slug}", response_model=RegistrationPublicRead)
async def read_public_registration(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> RegistrationPublicRead:
    row = await _load_registration_with_star(db, slug=slug)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="StarWiki record not found.")

    registration, star = row
    if registration.public_page_visibility != "public":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="StarWiki record not found.")

    star_detail = await build_star_detail_response(star, db)
    usernames = await _load_usernames(db, registration.current_holder_user_id)
    return RegistrationPublicRead(
        id=registration.id,
        registration_number=registration.registration_number,
        status=registration.status,
        registered_display_name=registration.registered_display_name,
        dedication=registration.dedication,
        gift_message=registration.gift_message,
        is_gift=registration.is_gift,
        is_demo=registration.is_demo,
        claim_status=registration.claim_status,
        public_page_slug=registration.public_page_slug,
        public_page_visibility=registration.public_page_visibility,
        current_holder_username=usernames.get(registration.current_holder_user_id),
        star=star_detail,
    )


@router.get("/claim/{claim_token}", response_model=RegistrationClaimPreviewRead)
async def preview_claim(
    claim_token: str,
    db: AsyncSession = Depends(get_db),
) -> RegistrationClaimPreviewRead:
    result = await db.execute(
        select(Registration, Star)
        .join(Star, Star.id == Registration.star_id)
        .where(Registration.id == parse_claim_token(claim_token))
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim link not found.")

    registration, star = row
    purchaser_result = await db.execute(select(User).where(User.id == registration.purchaser_user_id))
    purchaser = purchaser_result.scalars().first()
    star_detail = await build_star_detail_response(star, db)
    usernames = await _load_usernames(db, registration.current_holder_user_id)
    return RegistrationClaimPreviewRead(
        registration_id=registration.id,
        registration_number=registration.registration_number,
        registered_display_name=registration.registered_display_name,
        recipient_name=registration.recipient_name,
        purchaser_name=purchaser.full_name if purchaser else None,
        gift_message=registration.gift_message,
        dedication=registration.dedication,
        claim_status=registration.claim_status,
        current_holder_username=usernames.get(registration.current_holder_user_id),
        can_claim=registration.claim_status == "claimable",
        is_demo=registration.is_demo,
        starwiki_url=_frontend_public_url(registration.public_page_slug),
        star=star_detail,
    )


@router.post("/claim/{claim_token}", response_model=RegistrationClaimResult)
async def claim_registration(
    claim_token: str,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> RegistrationClaimResult:
    result = await db.execute(
        select(Registration)
        .where(Registration.id == parse_claim_token(claim_token))
        .with_for_update()
    )
    registration = result.scalars().first()
    if registration is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim link not found.")
    if registration.claim_status != "claimable":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This registration can no longer be claimed.")

    previous_holder = registration.current_holder_user_id
    registration.current_holder_user_id = current_user.id
    registration.claim_status = "claimed"
    if registration.is_gift and previous_holder == registration.purchaser_user_id and registration.recipient_name:
        registration.status = "registered_gift_claimed"
    else:
        registration.status = "transferred"
    from datetime import datetime, timezone
    registration.claimed_at = datetime.now(timezone.utc)

    db.add(
        OwnershipHistory(
            registration_id=registration.id,
            from_user_id=previous_holder,
            to_user_id=current_user.id,
            event_type="gift_claimed",
            event_note="Gift recipient claimed this registration.",
            public_visibility=False,
        )
    )

    transaction_result = await db.execute(select(Transaction).where(Transaction.id == registration.transaction_id))
    transaction = transaction_result.scalars().first()
    star_result = await db.execute(select(Star).where(Star.id == registration.star_id))
    star = star_result.scalars().first()
    if star is not None:
        star.current_owner_user_id = current_user.id
        star.owner_name = registration.registered_display_name
    if transaction is not None:
        transaction.status = "fulfilled"

    await db.commit()
    return RegistrationClaimResult(
        registration_id=registration.id,
        transaction_id=registration.transaction_id,
        claim_status=registration.claim_status,
        current_holder_user_id=current_user.id,
        starwiki_url=_frontend_public_url(registration.public_page_slug),
    )


@router.get("/{registration_id}", response_model=RegistrationAccountRead)
async def read_registration(
    registration_id: int,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> RegistrationAccountRead:
    row = await _load_registration_with_star(db, registration_id=registration_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found.")

    registration, star = row
    if not _can_access_registration(current_user, registration):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this registration.")

    star_detail = await build_star_detail_response(star, db)
    usernames = await _load_usernames(db, registration.current_holder_user_id)
    return RegistrationAccountRead(
        id=registration.id,
        transaction_id=registration.transaction_id,
        registration_number=registration.registration_number,
        status=registration.status,
        purchaser_user_id=registration.purchaser_user_id,
        current_holder_user_id=registration.current_holder_user_id,
        registered_display_name=registration.registered_display_name,
        dedication=registration.dedication,
        gift_message=registration.gift_message,
        recipient_name=registration.recipient_name,
        recipient_email=registration.recipient_email,
        is_gift=registration.is_gift,
        is_demo=registration.is_demo,
        claim_status=registration.claim_status,
        claimed_at=registration.claimed_at,
        public_page_slug=registration.public_page_slug,
        public_page_visibility=registration.public_page_visibility,
        ownership_history_visibility=registration.ownership_history_visibility,
        current_holder_username=usernames.get(registration.current_holder_user_id),
        can_manage=current_user.id == registration.current_holder_user_id,
        can_claim=registration.claim_status == "claimable",
        can_prepare_claim=current_user.id == registration.current_holder_user_id,
        claim_url=_frontend_claim_url(registration),
        starwiki_url=_frontend_public_url(registration.public_page_slug),
        star=star_detail,
    )


@router.post("/{registration_id}/prepare-claim", response_model=RegistrationAccountRead)
async def prepare_registration_claim(
    registration_id: int,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> RegistrationAccountRead:
    row = await _load_registration_with_star(db, registration_id=registration_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found.")

    registration, star = row
    if current_user.id != registration.current_holder_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the current holder can prepare a claim link.")

    registration.claim_status = "claimable"
    registration.claimed_at = None
    if registration.is_gift and registration.recipient_name:
        registration.status = "registered_gift_unclaimed"

    db.add(
        OwnershipHistory(
            registration_id=registration.id,
            from_user_id=current_user.id,
            to_user_id=None,
            event_type="claim_link_prepared",
            event_note="Current holder prepared a claim link for a future transfer.",
            public_visibility=False,
        )
    )
    await db.commit()
    await db.refresh(registration)

    star_detail = await build_star_detail_response(star, db)
    usernames = await _load_usernames(db, registration.current_holder_user_id)
    return RegistrationAccountRead(
        id=registration.id,
        transaction_id=registration.transaction_id,
        registration_number=registration.registration_number,
        status=registration.status,
        purchaser_user_id=registration.purchaser_user_id,
        current_holder_user_id=registration.current_holder_user_id,
        registered_display_name=registration.registered_display_name,
        dedication=registration.dedication,
        gift_message=registration.gift_message,
        recipient_name=registration.recipient_name,
        recipient_email=registration.recipient_email,
        is_gift=registration.is_gift,
        is_demo=registration.is_demo,
        claim_status=registration.claim_status,
        claimed_at=registration.claimed_at,
        public_page_slug=registration.public_page_slug,
        public_page_visibility=registration.public_page_visibility,
        ownership_history_visibility=registration.ownership_history_visibility,
        current_holder_username=usernames.get(registration.current_holder_user_id),
        can_manage=True,
        can_claim=registration.claim_status == "claimable",
        can_prepare_claim=True,
        claim_url=_frontend_claim_url(registration),
        starwiki_url=_frontend_public_url(registration.public_page_slug),
        star=star_detail,
    )
