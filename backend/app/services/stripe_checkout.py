from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

import stripe
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.star import Star
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.checkout import CheckoutFulfillmentResult

CHECKOUT_STATUS_CREATED = "checkout_created"
CHECKOUT_STATUS_FULFILLED = "fulfilled"
CHECKOUT_STATUS_PAYMENT_FAILED = "payment_failed"
CHECKOUT_STATUS_EXPIRED = "expired"
CHECKOUT_STATUS_CONFLICT = "conflict"

stripe.api_key = settings.STRIPE_SECRET_KEY or None


def _frontend_origin() -> str:
    return settings.cors_origins[0] if settings.cors_origins else settings.BACKEND_ORIGIN.rstrip("/")


def _build_registration_number(transaction: Transaction, issued_at: datetime) -> str:
    return f"AA-{issued_at:%Y%m%d}-{transaction.id:06d}"


def _ensure_registration_number(transaction: Transaction, issued_at: datetime) -> str:
    if transaction.registration_number:
        return transaction.registration_number

    transaction.registration_number = _build_registration_number(transaction, issued_at)
    return transaction.registration_number


def _stripe_value(value, key: str, default=None):
    if value is None:
        return default
    if isinstance(value, dict):
        return value.get(key, default)
    try:
        return value.get(key, default)
    except Exception:
        pass
    try:
        return value[key]
    except Exception:
        return default


def _stripe_id(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return _stripe_value(value, "id")


def _money_to_minor_units(value: Decimal | float | int) -> int:
    decimal_value = value if isinstance(value, Decimal) else Decimal(str(value))
    return int((decimal_value * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


async def _run_stripe_call(func, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)


def _transaction_amount_minor_units(star: Star, includes_certificate: bool) -> int:
    base_amount = _money_to_minor_units(star.price)
    certificate_amount = settings.STRIPE_CERTIFICATE_PRICE_GBP if includes_certificate else 0
    return base_amount + certificate_amount


def _line_items_for_star(star: Star, includes_certificate: bool) -> list[dict]:
    line_items = [
        {
            "quantity": 1,
            "price_data": {
                "currency": settings.STRIPE_CURRENCY,
                "unit_amount": _money_to_minor_units(star.price),
                "product_data": {
                    "name": f"{star.common_name or star.scientific_name} Registry Entry",
                    "description": "Aster Atlas private star registry entry",
                },
            },
        }
    ]

    if includes_certificate:
        line_items.append(
            {
                "quantity": 1,
                "price_data": {
                    "currency": settings.STRIPE_CURRENCY,
                    "unit_amount": settings.STRIPE_CERTIFICATE_PRICE_GBP,
                    "product_data": {
                        "name": "Digital Certificate",
                        "description": "High-resolution Aster Atlas certificate",
                    },
                },
            }
        )

    return line_items


async def create_embedded_checkout_session(
    db: AsyncSession,
    star_id: int,
    user: User,
    owner_name: str,
    includes_certificate: bool,
) -> tuple[str, str]:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe is not configured on the backend.",
        )

    result = await db.execute(select(Star).where(Star.id == star_id).with_for_update())
    star = result.scalars().first()

    if star is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Star not found.")

    if star.is_bought:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This star has already been claimed.")

    now = datetime.now(timezone.utc)
    transaction = Transaction(
        star_id=star.id,
        user_id=user.id,
        owner_name=owner_name.strip(),
        amount=Decimal(_transaction_amount_minor_units(star, includes_certificate)) / Decimal("100"),
        currency=settings.STRIPE_CURRENCY,
        includes_certificate=includes_certificate,
        status=CHECKOUT_STATUS_CREATED,
        accepted_terms_at=now,
        accepted_privacy_at=now,
    )
    db.add(transaction)
    await db.flush()

    frontend_origin = _frontend_origin().rstrip("/")
    session = await _run_stripe_call(
        stripe.checkout.Session.create,
        mode="payment",
        ui_mode="embedded_page",
        return_url=f"{frontend_origin}/checkout/complete?session_id={{CHECKOUT_SESSION_ID}}",
        customer_email=user.email,
        line_items=_line_items_for_star(star, includes_certificate),
        metadata={
            "transaction_id": str(transaction.id),
            "star_id": str(star.id),
            "user_id": str(user.id),
            "owner_name": owner_name.strip(),
            "includes_certificate": "true" if includes_certificate else "false",
        },
        payment_intent_data={
            "metadata": {
                "transaction_id": str(transaction.id),
                "star_id": str(star.id),
                "user_id": str(user.id),
            }
        },
    )
    session_expires_at = _stripe_value(session, "expires_at")
    transaction.stripe_checkout_session_id = _stripe_value(session, "id")
    transaction.checkout_expires_at = (
        datetime.fromtimestamp(session_expires_at, tz=timezone.utc)
        if session_expires_at
        else None
    )

    await db.commit()
    return _stripe_value(session, "client_secret"), _stripe_value(session, "id")


async def retrieve_checkout_session(session_id: str):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe is not configured on the backend.",
        )

    return await _run_stripe_call(stripe.checkout.Session.retrieve, session_id)


async def fulfill_checkout_session(db: AsyncSession, session_id: str) -> CheckoutFulfillmentResult:
    session = await retrieve_checkout_session(session_id)
    transaction_result = await db.execute(
        select(Transaction).where(Transaction.stripe_checkout_session_id == session_id).with_for_update()
    )
    transaction = transaction_result.scalars().first()

    if transaction is None:
        metadata = _stripe_value(session, "metadata")
        transaction_id = _stripe_value(metadata, "transaction_id")
        if not transaction_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")

        transaction_result = await db.execute(
            select(Transaction).where(Transaction.id == int(transaction_id)).with_for_update()
        )
        transaction = transaction_result.scalars().first()

        if transaction is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")

        if transaction.stripe_checkout_session_id and transaction.stripe_checkout_session_id != session_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Checkout session mismatch.")

    if transaction.status == CHECKOUT_STATUS_FULFILLED:
        star_result = await db.execute(select(Star).where(Star.id == transaction.star_id))
        star = star_result.scalars().first()
        issued_at = transaction.fulfilled_at or transaction.created_at or datetime.now(timezone.utc)
        registration_number = _ensure_registration_number(transaction, issued_at)
        await db.commit()
        return CheckoutFulfillmentResult(
            fulfilled=True,
            transaction_status=transaction.status,
            star_id=transaction.star_id,
            star_name=star.common_name or star.scientific_name,
            owner_name=transaction.owner_name,
            includes_certificate=transaction.includes_certificate,
            fulfilled_at=transaction.fulfilled_at,
            transaction_id=transaction.id,
            registration_number=registration_number,
        )

    session_status = _stripe_value(session, "status")
    payment_status = _stripe_value(session, "payment_status")
    payment_intent_id = _stripe_id(_stripe_value(session, "payment_intent"))

    if session_status != "complete" or payment_status != "paid":
        transaction.status = CHECKOUT_STATUS_PAYMENT_FAILED if payment_status == "unpaid" else transaction.status
        transaction.stripe_payment_intent_id = payment_intent_id or transaction.stripe_payment_intent_id
        await db.commit()
        star_result = await db.execute(select(Star).where(Star.id == transaction.star_id))
        star = star_result.scalars().first()
        return CheckoutFulfillmentResult(
            fulfilled=False,
            transaction_status=transaction.status,
            star_id=transaction.star_id,
            star_name=star.common_name or star.scientific_name,
            owner_name=transaction.owner_name,
            includes_certificate=transaction.includes_certificate,
            fulfilled_at=transaction.fulfilled_at,
            transaction_id=transaction.id,
            registration_number=transaction.registration_number,
        )

    star_result = await db.execute(select(Star).where(Star.id == transaction.star_id).with_for_update())
    star = star_result.scalars().first()

    if star is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Star not found.")

    if star.is_bought and transaction.status != CHECKOUT_STATUS_FULFILLED:
        transaction.status = CHECKOUT_STATUS_CONFLICT
        transaction.stripe_payment_intent_id = payment_intent_id or transaction.stripe_payment_intent_id
        await db.commit()
        return CheckoutFulfillmentResult(
            fulfilled=False,
            transaction_status=transaction.status,
            star_id=star.id,
            star_name=star.common_name or star.scientific_name,
            owner_name=transaction.owner_name,
            includes_certificate=transaction.includes_certificate,
            fulfilled_at=transaction.fulfilled_at,
            transaction_id=transaction.id,
            registration_number=transaction.registration_number,
        )

    now = datetime.now(timezone.utc)
    star.is_bought = True
    star.owner_name = transaction.owner_name
    star.purchase_date = now

    transaction.status = CHECKOUT_STATUS_FULFILLED
    transaction.registration_number = _ensure_registration_number(transaction, now)
    transaction.stripe_payment_intent_id = payment_intent_id or transaction.stripe_payment_intent_id
    transaction.fulfilled_at = now

    await db.commit()

    return CheckoutFulfillmentResult(
        fulfilled=True,
        transaction_status=transaction.status,
        star_id=star.id,
        star_name=star.common_name or star.scientific_name,
        owner_name=transaction.owner_name,
        includes_certificate=transaction.includes_certificate,
        fulfilled_at=transaction.fulfilled_at,
        transaction_id=transaction.id,
        registration_number=transaction.registration_number,
    )


async def mark_checkout_session_expired(db: AsyncSession, session_id: str) -> None:
    result = await db.execute(
        select(Transaction).where(Transaction.stripe_checkout_session_id == session_id).with_for_update()
    )
    transaction = result.scalars().first()
    if transaction is None or transaction.status == CHECKOUT_STATUS_FULFILLED:
        return

    transaction.status = CHECKOUT_STATUS_EXPIRED
    await db.commit()


async def mark_checkout_session_failed(db: AsyncSession, session_id: str) -> None:
    result = await db.execute(
        select(Transaction).where(Transaction.stripe_checkout_session_id == session_id).with_for_update()
    )
    transaction = result.scalars().first()
    if transaction is None or transaction.status == CHECKOUT_STATUS_FULFILLED:
        return

    transaction.status = CHECKOUT_STATUS_PAYMENT_FAILED
    await db.commit()
