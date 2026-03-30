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
        constellation=star.constellation,
        distance_ly=star.distance_ly,
        spectral_type=star.spectral_type,
        purchase_date=star.purchase_date,
        registration_number=transaction.registration_number,
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
    stars = [
        _star_summary(star, transaction)
        for transaction, star in rows
        if transaction.status == "fulfilled"
    ]

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

