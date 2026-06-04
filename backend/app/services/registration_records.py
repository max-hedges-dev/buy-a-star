from __future__ import annotations

import hashlib
import hmac
import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.ownership_history import OwnershipHistory
from app.models.registration import Registration
from app.models.star import Star
from app.models.transaction import Transaction
from app.models.user import User


def hash_claim_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def build_claim_token(registration_id: int) -> str:
    raw = f"claim:{registration_id}"
    signature = hmac.new(
        settings.SESSION_SECRET.encode("utf-8"),
        raw.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:24]
    return f"{registration_id}-{signature}"


def parse_claim_token(token: str) -> int | None:
    token = (token or "").strip()
    if "-" not in token:
        return None
    registration_part, provided_signature = token.split("-", 1)
    if not registration_part.isdigit():
        return None
    registration_id = int(registration_part)
    expected = build_claim_token(registration_id)
    if not hmac.compare_digest(expected, token):
        return None
    return registration_id


def slugify_record_name(value: str) -> str:
    normalized = (value or "").lower().strip().replace("'", "").replace("â€™", "").replace(".", "")
    return "-".join(segment for segment in re.sub(r"[^a-z0-9]+", "-", normalized).split("-") if segment)


def _registration_status(transaction: Transaction) -> str:
    if transaction.is_gift:
        return "registered_gift_unclaimed"
    if transaction.registration_type == "decide_later":
        return "registered_self"
    return "registered_self"


def _claim_status(transaction: Transaction) -> str:
    return "claimable" if transaction.is_gift else "not_claimable"


def _display_name(transaction: Transaction, purchaser: User) -> str:
    fallback_name = purchaser.full_name or purchaser.email.split("@")[0]
    return (transaction.owner_name or fallback_name or "Registered star").strip()


async def ensure_registration_for_transaction(
    db: AsyncSession,
    *,
    transaction: Transaction,
    star: Star,
    purchaser: User,
    issued_at: datetime | None = None,
) -> tuple[Registration, str | None]:
    result = await db.execute(
        select(Registration).where(Registration.transaction_id == transaction.id).with_for_update()
    )
    existing = result.scalars().first()
    if existing is not None:
        return existing, None

    issued = issued_at or transaction.fulfilled_at or transaction.created_at or datetime.now(timezone.utc)
    registration_number = transaction.registration_number or build_registration_number(transaction, issued)
    public_slug_base = slugify_record_name(_display_name(transaction, purchaser)) or f"star-{star.id}"
    public_page_slug = f"{public_slug_base}-{registration_number.lower()}"

    registration = Registration(
        star_id=star.id,
        transaction_id=transaction.id,
        registration_number=registration_number,
        status=_registration_status(transaction),
        purchaser_user_id=purchaser.id,
        current_holder_user_id=transaction.user_id,
        recipient_name=transaction.recipient_name,
        recipient_email=transaction.recipient_email,
        registered_display_name=_display_name(transaction, purchaser),
        dedication=transaction.dedication,
        gift_message=transaction.gift_message,
        is_gift=transaction.is_gift,
        is_demo=transaction.is_demo,
        claim_status=_claim_status(transaction),
        claim_token_hash=None,
        public_page_slug=public_page_slug,
        public_page_visibility="public",
        ownership_history_visibility="private",
    )
    db.add(registration)
    await db.flush()
    claim_token = build_claim_token(registration.id) if transaction.is_gift else None
    if claim_token:
        registration.claim_token_hash = hash_claim_token(claim_token)

    db.add(
        OwnershipHistory(
            registration_id=registration.id,
            from_user_id=None,
            to_user_id=transaction.user_id,
            event_type="registration_created",
            event_note="Initial Aster Atlas registration created.",
            public_visibility=False,
        )
    )
    await db.flush()
    return registration, claim_token
def build_registration_number(transaction: Transaction, issued_at: datetime) -> str:
    return f"AA-{issued_at:%Y%m%d}-{transaction.id:06d}"
