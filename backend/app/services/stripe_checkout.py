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
from app.services.certificate_options import certificate_label, get_certificate_option
from app.services.pricing import (
    certificate_price_for_country,
    major_amount_from_minor_units,
    normalize_country_code,
    pricing_quote_for_country,
    shipping_display_name,
    star_price_for_country,
)
from app.services.registration_records import build_claim_token, ensure_registration_for_transaction

CHECKOUT_STATUS_CREATED = "checkout_created"
CHECKOUT_STATUS_FULFILLED = "fulfilled"
CHECKOUT_STATUS_PAYMENT_FAILED = "payment_failed"
CHECKOUT_STATUS_EXPIRED = "expired"
CHECKOUT_STATUS_CONFLICT = "conflict"

stripe.api_key = settings.STRIPE_SECRET_KEY or None


def _frontend_origin() -> str:
    return settings.cors_origins[0] if settings.cors_origins else settings.BACKEND_ORIGIN.rstrip("/")


def _star_display_name(star: Star) -> str:
    return star.common_name or star.display_name or star.scientific_name


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


def _decimal_amount(amount_minor_units: int, currency: str) -> Decimal:
    return major_amount_from_minor_units(amount_minor_units, currency).quantize(Decimal("0.01"))


async def _run_stripe_call(func, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)


def _transaction_amount_minor_units(star: Star, certificate_type: str, country_code: str) -> int:
    option = get_certificate_option(certificate_type)
    base_amount = star_price_for_country(star, country_code).amount_minor_units
    certificate_amount = certificate_price_for_country(certificate_type, country_code).amount_minor_units
    shipping_amount = pricing_quote_for_country(country_code).shipping_price.amount_minor_units if option.shipping_required else 0
    return base_amount + certificate_amount + shipping_amount


def _serialize_shipping_address(address) -> dict | None:
    if not address:
        return None
    return {
        "line1": _stripe_value(address, "line1"),
        "line2": _stripe_value(address, "line2"),
        "city": _stripe_value(address, "city"),
        "state": _stripe_value(address, "state"),
        "postal_code": _stripe_value(address, "postal_code"),
        "country": _stripe_value(address, "country"),
    }


def _line_items_for_star(star: Star, certificate_type: str, country_code: str) -> list[dict]:
    option = get_certificate_option(certificate_type)
    star_price = star_price_for_country(star, country_code)
    certificate_price = certificate_price_for_country(certificate_type, country_code)
    star_name = _star_display_name(star)
    line_items = [
        {
            "quantity": 1,
            "price_data": {
                "currency": star_price.currency,
                "unit_amount": star_price.amount_minor_units,
                "product_data": {
                    "name": f"Star Registration: {star_name}",
                    "description": f"Private Aster Atlas registry entry for {star_name}",
                },
            },
        }
    ]

    line_items.append(
        {
            "quantity": 1,
            "price_data": {
                "currency": certificate_price.currency,
                "unit_amount": certificate_price.amount_minor_units,
                "product_data": {
                    "name": option.label,
                    "description": option.description,
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
    registration_type: str,
    recipient_name: str | None,
    recipient_email: str | None,
    dedication: str | None,
    gift_message: str | None,
    certificate_type: str,
    country_code: str,
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
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This star has already been registered.")

    option = get_certificate_option(certificate_type)
    normalized_country = normalize_country_code(country_code)
    quote = pricing_quote_for_country(normalized_country)
    star_name = _star_display_name(star)
    clean_owner_name = owner_name.strip()
    now = datetime.now(timezone.utc)
    transaction = Transaction(
        star_id=star.id,
        user_id=user.id,
        owner_name=clean_owner_name,
        registration_type=registration_type,
        recipient_name=(recipient_name or "").strip() or None,
        recipient_email=(recipient_email or "").strip() or None,
        dedication=(dedication or "").strip() or None,
        gift_message=(gift_message or "").strip() or None,
        is_gift=registration_type == "gift",
        is_demo=False,
        payment_provider="stripe",
        payment_status="pending",
        amount=_decimal_amount(_transaction_amount_minor_units(star, option.code, normalized_country), quote.currency),
        currency=quote.currency,
        includes_certificate=True,
        certificate_type=option.code,
        shipping_required=option.shipping_required,
        shipping_amount=_decimal_amount(
            quote.shipping_price.amount_minor_units if option.shipping_required else 0,
            quote.currency,
        ),
        transaction_type="primary",
        status=CHECKOUT_STATUS_CREATED,
        accepted_terms_at=now,
        accepted_privacy_at=now,
    )
    db.add(transaction)
    await db.flush()

    frontend_origin = _frontend_origin().rstrip("/")
    metadata = {
        "certificate_type": option.label,
        "shipping_required": "true" if option.shipping_required else "false",
        "internal_order_id": str(transaction.id),
        "star_name": star_name,
        "certificate_name": clean_owner_name,
        "certificate_type_code": option.code,
        "star_id": str(star.id),
        "user_id": str(user.id),
        "country_code": normalized_country,
        "presentment_currency": quote.currency,
        "registration_type": registration_type,
        "recipient_name": (recipient_name or "").strip(),
        "recipient_email": (recipient_email or "").strip(),
        "dedication": (dedication or "").strip(),
        "gift_message": (gift_message or "").strip(),
    }
    payment_description = f"Aster Atlas: {star_name} for {clean_owner_name} ({option.label})"
    session_payload = {
        "mode": "payment",
        "ui_mode": "embedded_page",
        "return_url": f"{frontend_origin}/checkout/complete?session_id={{CHECKOUT_SESSION_ID}}",
        "customer_email": user.email,
        "line_items": _line_items_for_star(star, option.code, normalized_country),
        "metadata": metadata,
        "payment_intent_data": {
            "description": payment_description,
            "metadata": metadata,
        },
    }
    if option.shipping_required:
        session_payload["shipping_address_collection"] = {
            "allowed_countries": [normalized_country],
        }
        session_payload["shipping_options"] = [
            {
                "shipping_rate_data": {
                    "display_name": shipping_display_name(normalized_country),
                    "type": "fixed_amount",
                    "fixed_amount": {
                        "amount": quote.shipping_price.amount_minor_units,
                        "currency": quote.currency,
                    },
                    "delivery_estimate": {
                        "minimum": {"unit": "business_day", "value": 2},
                        "maximum": {"unit": "business_day", "value": 7},
                    },
                }
            },
        ]
        session_payload["phone_number_collection"] = {"enabled": True}

    session = await _run_stripe_call(
        stripe.checkout.Session.create,
        **session_payload,
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
        transaction_id = _stripe_value(metadata, "internal_order_id")
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
        purchaser_result = await db.execute(select(User).where(User.id == transaction.user_id))
        purchaser = purchaser_result.scalars().first()
        issued_at = transaction.fulfilled_at or transaction.created_at or datetime.now(timezone.utc)
        registration_number = _ensure_registration_number(transaction, issued_at)
        registration, claim_token = await ensure_registration_for_transaction(
            db,
            transaction=transaction,
            star=star,
            purchaser=purchaser,
            issued_at=issued_at,
        )
        claim_url = f"{_frontend_origin().rstrip('/')}/claim/{claim_token or build_claim_token(registration.id)}" if registration.claim_status == "claimable" else None
        await db.commit()
        return CheckoutFulfillmentResult(
            fulfilled=True,
            transaction_status=transaction.status,
            registration_id=registration.id,
            public_page_slug=registration.public_page_slug,
            star_id=transaction.star_id,
            star_name=_star_display_name(star),
            owner_name=transaction.owner_name,
            registration_type=transaction.registration_type,
            recipient_name=transaction.recipient_name,
            claim_status=registration.claim_status,
            claim_url=claim_url,
            is_demo=transaction.is_demo,
            includes_certificate=transaction.includes_certificate,
            certificate_type=transaction.certificate_type,
            certificate_label=certificate_label(transaction.certificate_type),
            shipping_required=transaction.shipping_required,
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
        transaction.payment_status = payment_status or transaction.payment_status
        await db.commit()
        star_result = await db.execute(select(Star).where(Star.id == transaction.star_id))
        star = star_result.scalars().first()
        return CheckoutFulfillmentResult(
            fulfilled=False,
            transaction_status=transaction.status,
            registration_id=None,
            public_page_slug=None,
            star_id=transaction.star_id,
            star_name=_star_display_name(star),
            owner_name=transaction.owner_name,
            registration_type=transaction.registration_type,
            recipient_name=transaction.recipient_name,
            claim_status=None,
            claim_url=None,
            is_demo=transaction.is_demo,
            includes_certificate=transaction.includes_certificate,
            certificate_type=transaction.certificate_type,
            certificate_label=certificate_label(transaction.certificate_type),
            shipping_required=transaction.shipping_required,
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
            registration_id=None,
            public_page_slug=None,
            star_id=star.id,
            star_name=_star_display_name(star),
            owner_name=transaction.owner_name,
            registration_type=transaction.registration_type,
            recipient_name=transaction.recipient_name,
            claim_status=None,
            claim_url=None,
            is_demo=transaction.is_demo,
            includes_certificate=transaction.includes_certificate,
            certificate_type=transaction.certificate_type,
            certificate_label=certificate_label(transaction.certificate_type),
            shipping_required=transaction.shipping_required,
            fulfilled_at=transaction.fulfilled_at,
            transaction_id=transaction.id,
            registration_number=transaction.registration_number,
        )

    now = datetime.now(timezone.utc)
    star.is_bought = True
    star.current_owner_user_id = transaction.user_id
    star.owner_name = transaction.owner_name
    star.purchase_date = now

    transaction.status = CHECKOUT_STATUS_FULFILLED
    transaction.payment_status = "paid"
    transaction.registration_number = _ensure_registration_number(transaction, now)
    transaction.stripe_payment_intent_id = payment_intent_id or transaction.stripe_payment_intent_id
    transaction.fulfilled_at = now
    transaction.shipping_rate_id = _stripe_id(_stripe_value(_stripe_value(session, "shipping_cost"), "shipping_rate"))
    transaction.shipping_amount = _decimal_amount(
        _stripe_value(_stripe_value(session, "shipping_cost"), "amount_total", 0) or 0,
        transaction.currency,
    )
    shipping_details = _stripe_value(session, "shipping_details")
    transaction.shipping_name = _stripe_value(shipping_details, "name")
    transaction.shipping_phone = _stripe_value(shipping_details, "phone") or _stripe_value(
        _stripe_value(session, "customer_details"),
        "phone",
    )
    transaction.shipping_address = _serialize_shipping_address(_stripe_value(shipping_details, "address"))

    purchaser_result = await db.execute(select(User).where(User.id == transaction.user_id))
    purchaser = purchaser_result.scalars().first()
    registration, claim_token = await ensure_registration_for_transaction(
        db,
        transaction=transaction,
        star=star,
        purchaser=purchaser,
        issued_at=now,
    )

    await db.commit()

    return CheckoutFulfillmentResult(
        fulfilled=True,
        transaction_status=transaction.status,
        registration_id=registration.id,
        public_page_slug=registration.public_page_slug,
        star_id=star.id,
        star_name=_star_display_name(star),
        owner_name=transaction.owner_name,
        registration_type=transaction.registration_type,
        recipient_name=transaction.recipient_name,
        claim_status=registration.claim_status,
        claim_url=f"{_frontend_origin().rstrip('/')}/claim/{claim_token or build_claim_token(registration.id)}" if registration.claim_status == "claimable" else None,
        is_demo=transaction.is_demo,
        includes_certificate=transaction.includes_certificate,
        certificate_type=transaction.certificate_type,
        certificate_label=certificate_label(transaction.certificate_type),
        shipping_required=transaction.shipping_required,
        fulfilled_at=transaction.fulfilled_at,
        transaction_id=transaction.id,
        registration_number=transaction.registration_number,
    )


async def complete_demo_checkout(
    db: AsyncSession,
    *,
    star_id: int,
    user: User,
    owner_name: str,
    registration_type: str,
    recipient_name: str | None,
    recipient_email: str | None,
    dedication: str | None,
    gift_message: str | None,
    certificate_type: str,
    country_code: str,
) -> CheckoutFulfillmentResult:
    result = await db.execute(select(Star).where(Star.id == star_id).with_for_update())
    star = result.scalars().first()

    if star is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Star not found.")
    if star.is_bought:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This star has already been registered.")

    option = get_certificate_option(certificate_type)
    normalized_country = normalize_country_code(country_code)
    quote = pricing_quote_for_country(normalized_country)
    now = datetime.now(timezone.utc)
    clean_owner_name = owner_name.strip()

    transaction = Transaction(
        star_id=star.id,
        user_id=user.id,
        owner_name=clean_owner_name,
        registration_type=registration_type,
        recipient_name=(recipient_name or "").strip() or None,
        recipient_email=(recipient_email or "").strip() or None,
        dedication=(dedication or "").strip() or None,
        gift_message=(gift_message or "").strip() or None,
        is_gift=registration_type == "gift",
        is_demo=True,
        payment_provider="demo",
        payment_status="demo_paid",
        amount=_decimal_amount(_transaction_amount_minor_units(star, option.code, normalized_country), quote.currency),
        currency=quote.currency,
        includes_certificate=True,
        certificate_type=option.code,
        shipping_required=option.shipping_required,
        shipping_amount=_decimal_amount(
            quote.shipping_price.amount_minor_units if option.shipping_required else 0,
            quote.currency,
        ),
        transaction_type="primary",
        status=CHECKOUT_STATUS_FULFILLED,
        accepted_terms_at=now,
        accepted_privacy_at=now,
        fulfilled_at=now,
    )
    db.add(transaction)
    await db.flush()
    transaction.registration_number = _ensure_registration_number(transaction, now)

    star.is_bought = True
    star.current_owner_user_id = transaction.user_id
    star.owner_name = transaction.owner_name
    star.purchase_date = now

    registration, claim_token = await ensure_registration_for_transaction(
        db,
        transaction=transaction,
        star=star,
        purchaser=user,
        issued_at=now,
    )

    await db.commit()

    return CheckoutFulfillmentResult(
        fulfilled=True,
        transaction_status=transaction.status,
        transaction_id=transaction.id,
        registration_id=registration.id,
        public_page_slug=registration.public_page_slug,
        registration_number=transaction.registration_number,
        star_id=star.id,
        star_name=_star_display_name(star),
        owner_name=transaction.owner_name,
        registration_type=transaction.registration_type,
        recipient_name=transaction.recipient_name,
        claim_status=registration.claim_status,
        claim_url=f"{_frontend_origin().rstrip('/')}/claim/{claim_token or build_claim_token(registration.id)}" if registration.claim_status == "claimable" else None,
        is_demo=transaction.is_demo,
        includes_certificate=transaction.includes_certificate,
        certificate_type=transaction.certificate_type,
        certificate_label=certificate_label(transaction.certificate_type),
        shipping_required=transaction.shipping_required,
        fulfilled_at=transaction.fulfilled_at,
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
