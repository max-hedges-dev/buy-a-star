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


def _current_star_price(star: Star) -> float:
    for candidate in (star.model_value, star.issue_price, star.price):
        if candidate is not None:
            return float(candidate)
    return 0.0

router = APIRouter()


def _star_display_name(star: Star) -> str:
    return star.common_name or star.display_name or star.scientific_name


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
) -> AccountStarSummary:
    return AccountStarSummary(
        id=star.id,
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
    )


def _order_summary(
    transaction: Transaction,
    star: Star,
    registration: Registration | None,
    current_user: User,
    holder_username: str | None = None,
) -> AccountOrderSummary:
    return AccountOrderSummary(
        id=transaction.id,
        registration_id=registration.id if registration else None,
        public_page_slug=registration.public_page_slug if registration else None,
        registration_number=(registration.registration_number if registration else None) or transaction.registration_number,
        status=transaction.status,
        owner_name=transaction.owner_name,
        recipient_name=(registration.recipient_name if registration else None) or transaction.recipient_name,
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
        star=_star_summary(star, transaction, registration, current_user, holder_username),
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

    orders = [
        _order_summary(transaction, star, registration, current_user, holder_username)
        for transaction, star, registration, holder_username in rows
    ]

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
        stars.append(_star_summary(star, transaction, registration, current_user, holder_username))

    return AccountOverviewResponse(orders=orders, stars=stars)


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
    summary = _order_summary(transaction, star, registration, current_user, holder_username)

    return AccountOrderDetail(
        **summary.model_dump(),
        certificate_available=transaction.includes_certificate and transaction.status == "fulfilled",
    )
