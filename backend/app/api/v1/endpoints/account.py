from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_current_user
from app.db.session import get_db
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


def _star_summary(star: Star, transaction: Transaction) -> AccountStarSummary:
    return AccountStarSummary(
        id=star.id,
        display_name=_star_display_name(star),
        scientific_name=star.scientific_name,
        owner_name=transaction.owner_name or star.owner_name,
        category=star.category,
        price=_current_star_price(star),
        constellation=star.constellation,
        distance_ly=star.distance_ly,
        spectral_type=star.spectral_type,
        purchase_date=star.purchase_date,
        registration_number=transaction.registration_number,
        is_current_owner=star.current_owner_user_id == transaction.user_id,
    )


def _order_summary(transaction: Transaction, star: Star) -> AccountOrderSummary:
    return AccountOrderSummary(
        id=transaction.id,
        registration_number=transaction.registration_number,
        status=transaction.status,
        owner_name=transaction.owner_name,
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
        star=_star_summary(star, transaction),
    )


@router.get("/overview", response_model=AccountOverviewResponse)
async def read_account_overview(
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountOverviewResponse:
    result = await db.execute(
        select(Transaction, Star)
        .join(Star, Star.id == Transaction.star_id)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.created_at.desc(), Transaction.id.desc())
    )
    rows = result.all()

    orders = [_order_summary(transaction, star) for transaction, star in rows]

    owned_result = await db.execute(
        select(Star, Transaction)
        .join(Transaction, Transaction.star_id == Star.id)
        .where(
            Star.current_owner_user_id == current_user.id,
            Transaction.user_id == current_user.id,
            Transaction.status == "fulfilled",
        )
        .order_by(Transaction.fulfilled_at.desc().nullslast(), Transaction.id.desc())
    )
    seen_star_ids = set()
    stars = []
    for star, transaction in owned_result.all():
        if star.id in seen_star_ids:
            continue
        seen_star_ids.add(star.id)
        stars.append(_star_summary(star, transaction))

    return AccountOverviewResponse(orders=orders, stars=stars)


@router.get("/orders/{transaction_id}", response_model=AccountOrderDetail)
async def read_account_order(
    transaction_id: int,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> AccountOrderDetail:
    result = await db.execute(
        select(Transaction, Star)
        .join(Star, Star.id == Transaction.star_id)
        .where(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
    )
    row = result.first()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    transaction, star = row
    summary = _order_summary(transaction, star)

    return AccountOrderDetail(
        **summary.model_dump(),
        certificate_available=transaction.includes_certificate and transaction.status == "fulfilled",
    )
