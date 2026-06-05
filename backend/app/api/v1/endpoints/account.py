from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_current_user
from app.db.session import get_db
from app.models.registration import Registration
from app.models.star import Star
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.account import (
    AccountOrderDetail,
    AccountOrderSummary,
    AccountOverviewResponse,
    AccountStarSummary,
)
from app.services.certificate_options import certificate_label
from app.services.stripe_checkout import get_effective_hold_expires_at
from app.api.v1.endpoints.stars import get_star_slug


def _current_star_price(star: Star) -> float:
    for candidate in (star.model_value, star.issue_price, star.price):
        if candidate is not None:
            return float(candidate)
    return 0.0

router = APIRouter()


def _star_display_name(star: Star) -> str:
    return star.common_name or star.display_name or star.scientific_name


def _is_cart_like_status(transaction: Transaction) -> bool:
    return transaction.status in {"checkout_created", "expired", "payment_failed"}


def _hold_active(transaction: Transaction) -> bool:
    effective_expires_at = get_effective_hold_expires_at(transaction)
    return bool(
        _is_cart_like_status(transaction)
        and effective_expires_at
        and effective_expires_at > datetime.now(timezone.utc)
    )


async def _active_holds_by_star(db: AsyncSession, star_ids: list[int]) -> dict[int, Transaction]:
    if not star_ids:
        return {}

    result = await db.execute(
        select(Transaction)
        .where(
            Transaction.star_id.in_(star_ids),
            Transaction.status == "checkout_created",
        )
        .order_by(Transaction.star_id.asc(), Transaction.created_at.desc(), Transaction.id.desc())
    )
    holds_by_star: dict[int, Transaction] = {}
    for transaction in result.scalars().all():
        effective_expires_at = get_effective_hold_expires_at(transaction)
        if effective_expires_at and effective_expires_at > datetime.now(timezone.utc):
            holds_by_star.setdefault(transaction.star_id, transaction)
    return holds_by_star


def _holder_label(current_user: User, registration: Registration) -> str:
    if registration.current_holder_user_id == current_user.id:
        return current_user.username or current_user.full_name or "You"
    if registration.recipient_name and registration.claim_status == "claimable":
        return f"Gift waiting for {registration.recipient_name}"
    return registration.registered_display_name


def _star_summary(
    star: Star,
    transaction: Transaction,
    registration: Registration | None,
    current_user: User,
    holder_username: str | None = None,
    active_hold: Transaction | None = None,
) -> AccountStarSummary:
    return AccountStarSummary(
        id=star.id,
        star_slug=get_star_slug(star),
        registration_id=registration.id if registration else None,
        transaction_id=transaction.id,
        public_page_slug=registration.public_page_slug if registration else None,
        display_name=(registration.registered_display_name if registration else None) or _star_display_name(star),
        scientific_name=star.scientific_name,
        owner_name=(registration.registered_display_name if registration else None) or transaction.owner_name or star.owner_name,
        owner_username=holder_username,
        recipient_name=registration.recipient_name if registration else transaction.recipient_name,
        dedication=registration.dedication if registration else transaction.dedication,
        current_holder_label=_holder_label(current_user, registration) if registration else None,
        current_holder_username=holder_username,
        claim_status=registration.claim_status if registration else None,
        status=registration.status if registration else transaction.status,
        is_gift=registration.is_gift if registration else transaction.is_gift,
        is_demo=registration.is_demo if registration else transaction.is_demo,
        category=star.category,
        price=_current_star_price(star),
        constellation=star.constellation,
        distance_ly=star.distance_ly,
        spectral_type=star.spectral_type,
        purchase_date=star.purchase_date,
        registration_number=registration.registration_number if registration else transaction.registration_number,
        is_current_owner=star.current_owner_user_id == transaction.user_id,
        is_bought=bool(star.is_bought),
        active_hold_expires_at=get_effective_hold_expires_at(active_hold) if active_hold else None,
        held_in_another_cart=bool(active_hold and active_hold.user_id != current_user.id),
        hold_owner_name=active_hold.owner_name if active_hold else None,
    )


def _order_summary(
    transaction: Transaction,
    star: Star,
    registration: Registration | None,
    current_user: User,
    holder_username: str | None = None,
    active_hold: Transaction | None = None,
) -> AccountOrderSummary:
    star_still_available = not bool(star.is_bought)
    hold_owned_by_current_user = bool(active_hold and active_hold.user_id == current_user.id)
    no_active_hold_exists = active_hold is None
    can_proceed_to_payment = (
        _is_cart_like_status(transaction)
        and star_still_available
        and (no_active_hold_exists or hold_owned_by_current_user)
    )
    return AccountOrderSummary(
        id=transaction.id,
        registration_id=registration.id if registration else None,
        public_page_slug=registration.public_page_slug if registration else None,
        registration_number=(registration.registration_number if registration else None) or transaction.registration_number,
        status=transaction.status,
        owner_name=transaction.owner_name,
        recipient_name=(registration.recipient_name if registration else None) or transaction.recipient_name,
        recipient_email=transaction.recipient_email,
        dedication=(registration.dedication if registration else None) or transaction.dedication,
        gift_message=(registration.gift_message if registration else None) or transaction.gift_message,
        registration_type=transaction.registration_type,
        claim_status=registration.claim_status if registration else None,
        is_gift=registration.is_gift if registration else transaction.is_gift,
        is_demo=registration.is_demo if registration else transaction.is_demo,
        amount=float(transaction.amount),
        currency=transaction.currency,
        includes_certificate=transaction.includes_certificate,
        certificate_type=transaction.certificate_type,
        certificate_label=certificate_label(transaction.certificate_type),
        shipping_required=transaction.shipping_required,
        shipping_amount=float(transaction.shipping_amount or 0),
        transaction_type=transaction.transaction_type,
        created_at=transaction.created_at,
        fulfilled_at=transaction.fulfilled_at,
        hold_expires_at=get_effective_hold_expires_at(transaction),
        hold_active=_hold_active(transaction),
        can_proceed_to_payment=can_proceed_to_payment,
        is_star_still_available=star_still_available,
        star=_star_summary(star, transaction, registration, current_user, holder_username, active_hold),
    )


@router.get("/overview", response_model=AccountOverviewResponse)
async def read_account_overview(
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountOverviewResponse:
    result = await db.execute(
        select(Transaction, Star, Registration, User.username)
        .join(Star, Star.id == Transaction.star_id)
        .outerjoin(Registration, Registration.transaction_id == Transaction.id)
        .outerjoin(User, User.id == Registration.current_holder_user_id)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.created_at.desc(), Transaction.id.desc())
    )
    rows = result.all()
    active_holds_by_star = await _active_holds_by_star(db, [star.id for _, star, _, _ in rows])

    all_summaries = [
        _order_summary(transaction, star, registration, current_user, holder_username, active_holds_by_star.get(star.id))
        for transaction, star, registration, holder_username in rows
    ]
    orders = [summary for summary in all_summaries if summary.status == "fulfilled"]
    cart_items = [summary for summary in all_summaries if summary.status in {"checkout_created", "expired", "payment_failed"}]

    owned_result = await db.execute(
        select(Star, Transaction, Registration, User.username)
        .join(Transaction, Transaction.star_id == Star.id)
        .outerjoin(Registration, Registration.transaction_id == Transaction.id)
        .outerjoin(User, User.id == Registration.current_holder_user_id)
        .where(
            Transaction.status == "fulfilled",
            or_(
                Star.current_owner_user_id == current_user.id,
                Registration.current_holder_user_id == current_user.id,
                (Registration.purchaser_user_id == current_user.id) & (Registration.claim_status == "claimable"),
            ),
        )
        .order_by(Transaction.fulfilled_at.desc().nullslast(), Transaction.id.desc())
    )
    seen_star_ids = set()
    stars = []
    for star, transaction, registration, holder_username in owned_result.all():
        if star.id in seen_star_ids:
            continue
        seen_star_ids.add(star.id)
        stars.append(_star_summary(star, transaction, registration, current_user, holder_username, active_holds_by_star.get(star.id)))

    return AccountOverviewResponse(orders=orders, cart_items=cart_items, stars=stars)


@router.get("/orders/{transaction_id}", response_model=AccountOrderDetail)
async def read_account_order(
    transaction_id: int,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountOrderDetail:
    result = await db.execute(
        select(Transaction, Star, Registration, User.username)
        .join(Star, Star.id == Transaction.star_id)
        .outerjoin(Registration, Registration.transaction_id == Transaction.id)
        .outerjoin(User, User.id == Registration.current_holder_user_id)
        .where(Transaction.id == transaction_id)
    )
    row = result.first()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    transaction, star, registration, holder_username = row
    if transaction.user_id != current_user.id and (registration is None or registration.current_holder_user_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this order.")
    active_hold = (await _active_holds_by_star(db, [star.id])).get(star.id)
    summary = _order_summary(transaction, star, registration, current_user, holder_username, active_hold)

    return AccountOrderDetail(
        **summary.model_dump(),
        certificate_available=transaction.includes_certificate and transaction.status == "fulfilled",
    )
