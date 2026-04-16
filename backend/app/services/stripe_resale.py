from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

import stripe
from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.resale import ResaleListing, ResaleSale, SellerBalanceLedger
from app.models.star import Star
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.resale import (
    ResaleCheckoutStatusResponse,
    ResaleListingRead,
    SellerBalanceRead,
    SellerLedgerEntryRead,
    SellerStatusRead,
)
from app.services.stripe_checkout import _run_stripe_call, _stripe_id, _stripe_value

LISTING_ACTIVE = "active"
LISTING_CHECKOUT_PENDING = "checkout_pending"
LISTING_CANCELLED = "cancelled"
LISTING_SOLD = "sold"
SALE_CHECKOUT_CREATED = "checkout_created"
SALE_FULFILLED = "fulfilled"
SALE_PAYMENT_FAILED = "payment_failed"
SALE_REFUNDED = "refunded"
LEDGER_PENDING = "pending"
LEDGER_AVAILABLE = "available"
LEDGER_WITHDRAWN = "withdrawn"
LEDGER_FAILED = "failed"
LEDGER_REFUNDED = "refunded"
LEDGER_RECORDED = "recorded"
LEDGER_SPENDABLE_DEBIT_TYPES = {"refund", "withdrawal"}


def _money(value: Decimal | float | int) -> Decimal:
    return (value if isinstance(value, Decimal) else Decimal(str(value))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _minor_units(value: Decimal | float | int) -> int:
    return int((_money(value) * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _major_units(amount_minor: int) -> Decimal:
    return (Decimal(amount_minor) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _display_name(star: Star) -> str:
    return star.common_name or star.display_name or star.scientific_name


def _frontend_origin() -> str:
    return settings.cors_origins[0] if settings.cors_origins else settings.BACKEND_ORIGIN.rstrip("/")


def _ensure_test_mode() -> None:
    if settings.STRIPE_SECRET_KEY and settings.STRIPE_SECRET_KEY.startswith("sk_live_"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resale marketplace actions are test-mode only.",
        )


def _raise_seller_stripe_error(exc: stripe.error.StripeError) -> None:
    message = getattr(exc, "user_message", None) or str(exc)
    if "signed up for Connect" in message:
        message = (
            "Stripe Connect is not enabled for this Stripe test account yet. "
            "Open Stripe Dashboard, complete the Connect platform setup, then try seller onboarding again."
        )
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message) from exc


def _seller_status(user: User) -> SellerStatusRead:
    due = user.stripe_seller_requirements_due or []
    if not isinstance(due, list):
        due = []
    can_receive = bool(user.connected_account_id and user.stripe_seller_charges_enabled)
    can_withdraw = bool(user.connected_account_id and user.stripe_seller_payouts_enabled)
    return SellerStatusRead(
        connected_account_id=user.connected_account_id,
        onboarding_status=user.stripe_seller_onboarding_status or "not_started",
        charges_enabled=bool(user.stripe_seller_charges_enabled),
        payouts_enabled=bool(user.stripe_seller_payouts_enabled),
        details_submitted=bool(user.stripe_seller_details_submitted),
        requirements_due=due,
        can_receive_resale_payments=can_receive,
        can_withdraw=can_withdraw,
    )


async def sync_seller_account_status(user: User) -> SellerStatusRead:
    if not user.connected_account_id:
        return _seller_status(user)

    account = await _run_stripe_call(stripe.Account.retrieve, user.connected_account_id)
    requirements = _stripe_value(account, "requirements", {}) or {}
    due = list(_stripe_value(requirements, "currently_due", []) or [])
    user.stripe_seller_charges_enabled = bool(_stripe_value(account, "charges_enabled", False))
    user.stripe_seller_payouts_enabled = bool(_stripe_value(account, "payouts_enabled", False))
    user.stripe_seller_details_submitted = bool(_stripe_value(account, "details_submitted", False))
    user.stripe_seller_requirements_due = due
    if user.stripe_seller_charges_enabled and user.stripe_seller_payouts_enabled:
        user.stripe_seller_onboarding_status = "complete"
    elif user.stripe_seller_details_submitted:
        user.stripe_seller_onboarding_status = "pending"
    else:
        user.stripe_seller_onboarding_status = "required"
    return _seller_status(user)


async def create_seller_onboarding_link(db: AsyncSession, user: User) -> tuple[str, SellerStatusRead]:
    _ensure_test_mode()
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Stripe is not configured.")

    if not user.connected_account_id:
        try:
            account = await _run_stripe_call(
                stripe.Account.create,
                type="express",
                email=user.email,
                capabilities={"transfers": {"requested": True}},
                settings={"payouts": {"schedule": {"interval": "manual"}}},
                metadata={"aster_user_id": str(user.id), "aster_test_mode": "true"},
            )
        except stripe.error.StripeError as exc:
            _raise_seller_stripe_error(exc)
        user.connected_account_id = _stripe_value(account, "id")
        user.stripe_seller_onboarding_status = "required"
        await db.flush()

    origin = _frontend_origin().rstrip("/")
    try:
        account_link = await _run_stripe_call(
            stripe.AccountLink.create,
            account=user.connected_account_id,
            refresh_url=f"{origin}/account?section=balance&seller_onboarding=refresh",
            return_url=f"{origin}/account?section=balance&seller_onboarding=return",
            type="account_onboarding",
        )
    except stripe.error.StripeError as exc:
        _raise_seller_stripe_error(exc)
    seller = await sync_seller_account_status(user)
    await db.commit()
    return _stripe_value(account_link, "url"), seller


async def create_seller_dashboard_link(user: User) -> str:
    _ensure_test_mode()
    if not user.connected_account_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Complete seller onboarding first.")

    try:
        login_link = await _run_stripe_call(stripe.Account.create_login_link, user.connected_account_id)
    except stripe.error.StripeError as exc:
        _raise_seller_stripe_error(exc)
    return _stripe_value(login_link, "url")


async def resolve_current_owner_transaction(db: AsyncSession, star_id: int, user_id: int | None = None):
    conditions = [Transaction.star_id == star_id, Transaction.status == "fulfilled"]
    if user_id is not None:
        conditions.append(Transaction.user_id == user_id)
    result = await db.execute(
        select(Transaction)
        .where(*conditions)
        .order_by(Transaction.fulfilled_at.desc().nullslast(), Transaction.id.desc())
    )
    return result.scalars().first()


async def ensure_star_owner(db: AsyncSession, star: Star, user: User) -> None:
    if star.current_owner_user_id is None:
        latest = await resolve_current_owner_transaction(db, star.id)
        if latest and latest.user_id:
            star.current_owner_user_id = latest.user_id
            await db.flush()

    if star.current_owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the current owner can manage this star.")


def listing_read(listing: ResaleListing) -> ResaleListingRead:
    return ResaleListingRead(
        id=listing.id,
        star_id=listing.star_id,
        seller_user_id=listing.seller_user_id,
        price=float(listing.price),
        currency=listing.currency,
        status=listing.status,
        created_at=listing.created_at,
        expires_at=listing.expires_at,
        sold_at=listing.sold_at,
    )


async def get_active_listing_for_star(db: AsyncSession, star_id: int) -> ResaleListing | None:
    result = await db.execute(
        select(ResaleListing)
        .where(ResaleListing.star_id == star_id, ResaleListing.status == LISTING_ACTIVE)
        .order_by(ResaleListing.created_at.desc(), ResaleListing.id.desc())
    )
    return result.scalars().first()


async def get_open_listing_for_star(db: AsyncSession, star_id: int) -> ResaleListing | None:
    result = await db.execute(
        select(ResaleListing)
        .where(
            ResaleListing.star_id == star_id,
            ResaleListing.status.in_([LISTING_ACTIVE, LISTING_CHECKOUT_PENDING]),
        )
        .order_by(ResaleListing.created_at.desc(), ResaleListing.id.desc())
    )
    return result.scalars().first()


async def create_listing(db: AsyncSession, user: User, star_id: int, price: float, currency: str = "gbp") -> ResaleListing:
    seller = await sync_seller_account_status(user)
    if not seller.can_receive_resale_payments:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Complete Stripe seller onboarding before listing a star.")

    amount = _money(price)
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Listing price must be greater than zero.")
    if currency.lower() != "gbp":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resales currently support GBP only.")

    star = (await db.execute(select(Star).where(Star.id == star_id).with_for_update())).scalars().first()
    if star is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Star not found.")
    await ensure_star_owner(db, star, user)

    if await get_open_listing_for_star(db, star.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This star already has an active listing.")

    listing = ResaleListing(
        star_id=star.id,
        seller_user_id=user.id,
        price=amount,
        currency=currency.lower(),
        status=LISTING_ACTIVE,
    )
    db.add(listing)
    await db.commit()
    await db.refresh(listing)
    return listing


async def cancel_listing(db: AsyncSession, user: User, listing_id: int) -> ResaleListing:
    listing = (
        await db.execute(
            select(ResaleListing)
            .where(ResaleListing.id == listing_id, ResaleListing.seller_user_id == user.id)
            .with_for_update()
        )
    ).scalars().first()
    if listing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found.")
    if listing.status != LISTING_ACTIVE:
        return listing

    listing.status = LISTING_CANCELLED
    listing.cancelled_at = datetime.now(timezone.utc)
    listing.version += 1
    await db.commit()
    await db.refresh(listing)
    return listing


def calculate_platform_fee(gross: Decimal) -> Decimal:
    percent_fee = gross * (Decimal(str(settings.STRIPE_RESALE_PLATFORM_FEE_PERCENT)) / Decimal("100"))
    flat_fee = Decimal(settings.STRIPE_RESALE_PLATFORM_FEE_FLAT_GBP) / Decimal("100")
    fee = _money(percent_fee + flat_fee)
    return min(fee, gross)


async def create_resale_checkout_session(db: AsyncSession, buyer: User, listing_id: int) -> tuple[str, str]:
    _ensure_test_mode()
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Stripe is not configured.")

    listing = (
        await db.execute(select(ResaleListing).where(ResaleListing.id == listing_id).with_for_update())
    ).scalars().first()
    if listing is None or listing.status != LISTING_ACTIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing is not available.")
    if listing.seller_user_id == buyer.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot buy your own listing.")

    seller = (await db.execute(select(User).where(User.id == listing.seller_user_id))).scalars().first()
    star = (await db.execute(select(Star).where(Star.id == listing.star_id).with_for_update())).scalars().first()
    if seller is None or star is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing is no longer available.")
    if star.current_owner_user_id != seller.id:
        listing.status = LISTING_CANCELLED
        listing.cancelled_at = datetime.now(timezone.utc)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Seller no longer owns this star.")

    seller_status = await sync_seller_account_status(seller)
    if not seller_status.can_receive_resale_payments:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Seller cannot receive resale payments yet.")

    gross = _money(listing.price)
    platform_fee = calculate_platform_fee(gross)
    proceeds = gross - platform_fee
    sale = ResaleSale(
        listing_id=listing.id,
        star_id=star.id,
        seller_user_id=seller.id,
        buyer_user_id=buyer.id,
        amount=gross,
        currency=listing.currency,
        platform_fee_amount=platform_fee,
        seller_proceeds_amount=proceeds,
        status=SALE_CHECKOUT_CREATED,
    )
    db.add(sale)
    await db.flush()

    origin = _frontend_origin().rstrip("/")
    metadata = {
        "flow": "resale",
        "sale_id": str(sale.id),
        "listing_id": str(listing.id),
        "star_id": str(star.id),
        "seller_user_id": str(seller.id),
        "buyer_user_id": str(buyer.id),
        "test_mode_only": "true",
    }
    session = await _run_stripe_call(
        stripe.checkout.Session.create,
        mode="payment",
        ui_mode="embedded_page",
        return_url=f"{origin}/resale/complete?session_id={{CHECKOUT_SESSION_ID}}",
        customer_email=buyer.email,
        line_items=[
            {
                "quantity": 1,
                "price_data": {
                    "currency": listing.currency,
                    "unit_amount": _minor_units(gross),
                    "product_data": {
                        "name": f"Resale Star Transfer: {_display_name(star)}",
                        "description": "Peer-to-peer Aster Atlas ownership transfer",
                    },
                },
            }
        ],
        metadata=metadata,
        payment_intent_data={
            "application_fee_amount": _minor_units(platform_fee),
            "transfer_data": {"destination": seller.connected_account_id},
            "metadata": metadata,
        },
    )

    session_id = _stripe_value(session, "id")
    sale.stripe_checkout_session_id = session_id
    listing.stripe_checkout_session_id = session_id
    listing.status = LISTING_CHECKOUT_PENDING
    listing.version += 1
    await db.commit()
    return _stripe_value(session, "client_secret"), session_id


async def finalize_resale_checkout_session(db: AsyncSession, session_id: str) -> ResaleSale:
    sale = (
        await db.execute(select(ResaleSale).where(ResaleSale.stripe_checkout_session_id == session_id).with_for_update())
    ).scalars().first()
    if sale is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resale checkout not found.")
    if sale.status == SALE_FULFILLED:
        return sale

    session = await _run_stripe_call(stripe.checkout.Session.retrieve, session_id)
    if _stripe_value(session, "status") != "complete" or _stripe_value(session, "payment_status") != "paid":
        return sale

    listing = (
        await db.execute(select(ResaleListing).where(ResaleListing.id == sale.listing_id).with_for_update())
    ).scalars().first()
    star = (await db.execute(select(Star).where(Star.id == sale.star_id).with_for_update())).scalars().first()
    seller = (await db.execute(select(User).where(User.id == sale.seller_user_id))).scalars().first()
    buyer = (await db.execute(select(User).where(User.id == sale.buyer_user_id))).scalars().first()

    if listing is None or star is None or seller is None or buyer is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resale record is incomplete.")
    if listing.status != LISTING_CHECKOUT_PENDING or listing.stripe_checkout_session_id != session_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Listing is no longer active.")
    if star.current_owner_user_id != seller.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Seller no longer owns this star.")

    payment_intent_id = _stripe_id(_stripe_value(session, "payment_intent"))
    if payment_intent_id:
        payment_intent = await _run_stripe_call(
            stripe.PaymentIntent.retrieve,
            payment_intent_id,
            expand=["latest_charge"],
        )
        latest_charge = _stripe_value(payment_intent, "latest_charge")
        sale.stripe_payment_intent_id = payment_intent_id
        sale.stripe_charge_id = _stripe_id(latest_charge)
        sale.stripe_transfer_id = _stripe_id(_stripe_value(latest_charge, "transfer"))
        sale.stripe_application_fee_id = _stripe_id(_stripe_value(latest_charge, "application_fee"))

    now = datetime.now(timezone.utc)
    listing.status = LISTING_SOLD
    listing.sold_at = now
    listing.version += 1
    sale.status = SALE_FULFILLED
    sale.paid_at = now
    star.current_owner_user_id = buyer.id
    star.owner_name = buyer.full_name or buyer.email
    star.purchase_date = now
    star.last_sale_price = sale.amount
    star.last_sale_at = now
    star.ask_price = None

    resale_transaction = Transaction(
        star_id=star.id,
        user_id=buyer.id,
        owner_name=buyer.full_name or buyer.email,
        amount=sale.amount,
        currency=sale.currency,
        includes_certificate=False,
        certificate_type="digital",
        shipping_required=False,
        shipping_amount=0,
        transaction_type="resale",
        status="fulfilled",
        fulfilled_at=now,
        accepted_terms_at=now,
        accepted_privacy_at=now,
        stripe_checkout_session_id=None,
        stripe_payment_intent_id=sale.stripe_payment_intent_id,
    )
    db.add(resale_transaction)
    await db.flush()
    resale_transaction.registration_number = f"AA-RS-{now:%Y%m%d}-{resale_transaction.id:06d}"

    ledger = SellerBalanceLedger(
        user_id=seller.id,
        resale_sale_id=sale.id,
        entry_type="sale_proceeds",
        amount=sale.seller_proceeds_amount,
        currency=sale.currency,
        status=LEDGER_PENDING,
        available_at=now + timedelta(days=settings.STRIPE_RESALE_BALANCE_HOLD_DAYS),
        stripe_transfer_id=sale.stripe_transfer_id,
        entry_metadata={
            "gross": float(sale.amount),
            "platform_fee": float(sale.platform_fee_amount),
            "star_id": star.id,
        },
    )
    fee_ledger = SellerBalanceLedger(
        user_id=seller.id,
        resale_sale_id=sale.id,
        entry_type="platform_fee",
        amount=-sale.platform_fee_amount,
        currency=sale.currency,
        status=LEDGER_RECORDED,
        available_at=now,
        entry_metadata={"gross": float(sale.amount), "star_id": star.id},
    )
    db.add_all([ledger, fee_ledger])
    await db.commit()
    await db.refresh(sale)
    return sale


async def mark_resale_failed(db: AsyncSession, session_id: str) -> None:
    sale = (
        await db.execute(select(ResaleSale).where(ResaleSale.stripe_checkout_session_id == session_id).with_for_update())
    ).scalars().first()
    if sale and sale.status == SALE_CHECKOUT_CREATED:
        sale.status = SALE_PAYMENT_FAILED
        listing = (
            await db.execute(select(ResaleListing).where(ResaleListing.id == sale.listing_id).with_for_update())
        ).scalars().first()
        if (
            listing
            and listing.status == LISTING_CHECKOUT_PENDING
            and listing.stripe_checkout_session_id == session_id
        ):
            listing.status = LISTING_ACTIVE
            listing.stripe_checkout_session_id = None
            listing.version += 1
        await db.commit()


async def mark_available_ledger_entries(db: AsyncSession, user_id: int) -> None:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(SellerBalanceLedger).where(
            SellerBalanceLedger.user_id == user_id,
            SellerBalanceLedger.status == LEDGER_PENDING,
            SellerBalanceLedger.available_at.is_not(None),
            SellerBalanceLedger.available_at <= now,
        )
    )
    for entry in result.scalars().all():
        entry.status = LEDGER_AVAILABLE
    await db.flush()


def _balance_totals(entries: list[SellerBalanceLedger]) -> tuple[Decimal, Decimal]:
    pending = Decimal("0.00")
    available = Decimal("0.00")
    for entry in entries:
        amount = _money(entry.amount)
        if entry.entry_type == "sale_proceeds" and entry.status == LEDGER_PENDING and amount > 0:
            pending += amount
        elif entry.entry_type == "sale_proceeds" and entry.status == LEDGER_AVAILABLE:
            available += amount
        elif entry.entry_type in LEDGER_SPENDABLE_DEBIT_TYPES and entry.status != LEDGER_FAILED:
            available += amount
    return max(pending, Decimal("0.00")), max(available, Decimal("0.00"))


def _ledger_read(entry: SellerBalanceLedger) -> SellerLedgerEntryRead:
    return SellerLedgerEntryRead(
        id=entry.id,
        resale_sale_id=entry.resale_sale_id,
        entry_type=entry.entry_type,
        amount=float(entry.amount),
        currency=entry.currency,
        status=entry.status,
        available_at=entry.available_at,
        stripe_payout_id=entry.stripe_payout_id,
        error_message=entry.error_message,
        created_at=entry.created_at,
    )


async def read_seller_balance(db: AsyncSession, user: User) -> SellerBalanceRead:
    await mark_available_ledger_entries(db, user.id)
    result = await db.execute(
        select(SellerBalanceLedger)
        .where(SellerBalanceLedger.user_id == user.id)
        .order_by(SellerBalanceLedger.created_at.desc(), SellerBalanceLedger.id.desc())
    )
    entries = result.scalars().all()
    pending, available = _balance_totals(entries)
    await db.commit()
    return SellerBalanceRead(
        pending_balance=float(pending),
        available_balance=float(available),
        currency="gbp",
        entries=[_ledger_read(entry) for entry in entries],
        seller=_seller_status(user),
    )


async def create_withdrawal(db: AsyncSession, user: User, amount: float, currency: str = "gbp") -> tuple[str, Decimal, str]:
    _ensure_test_mode()
    seller = await sync_seller_account_status(user)
    if not seller.can_withdraw:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Complete payout onboarding before withdrawing.")
    if currency.lower() != "gbp":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Withdrawals currently support GBP only.")

    withdrawal = _money(amount)
    if withdrawal <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Withdrawal amount must be greater than zero.")

    await mark_available_ledger_entries(db, user.id)
    ledger_result = await db.execute(
        select(SellerBalanceLedger)
        .where(SellerBalanceLedger.user_id == user.id)
        .with_for_update()
    )
    locked_entries = ledger_result.scalars().all()
    _, available_balance = _balance_totals(locked_entries)
    if withdrawal > available_balance:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not enough available Aster Balance.")

    stripe_balance = await _run_stripe_call(stripe.Balance.retrieve, stripe_account=user.connected_account_id)
    available_items = _stripe_value(stripe_balance, "available", []) or []
    stripe_available_minor = sum(
        int(_stripe_value(item, "amount", 0) or 0)
        for item in available_items
        if (_stripe_value(item, "currency", "") or "").lower() == currency.lower()
    )
    if _minor_units(withdrawal) > stripe_available_minor:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Funds are still pending in Stripe and cannot be withdrawn yet.",
        )

    payout = await _run_stripe_call(
        stripe.Payout.create,
        amount=_minor_units(withdrawal),
        currency=currency.lower(),
        metadata={"aster_user_id": str(user.id), "entry_type": "withdrawal"},
        stripe_account=user.connected_account_id,
    )
    payout_id = _stripe_value(payout, "id")
    payout_status = _stripe_value(payout, "status") or "pending"
    ledger = SellerBalanceLedger(
        user_id=user.id,
        entry_type="withdrawal",
        amount=-withdrawal,
        currency=currency.lower(),
        status=LEDGER_WITHDRAWN if payout_status in {"paid", "pending", "in_transit"} else LEDGER_FAILED,
        available_at=datetime.now(timezone.utc),
        stripe_payout_id=payout_id,
        entry_metadata={"stripe_status": payout_status},
    )
    db.add(ledger)
    await db.commit()
    return payout_id, withdrawal, payout_status


async def resale_checkout_status(db: AsyncSession, session_id: str, user: User) -> ResaleCheckoutStatusResponse:
    sale = (
        await db.execute(select(ResaleSale).where(ResaleSale.stripe_checkout_session_id == session_id))
    ).scalars().first()
    if sale is None or sale.buyer_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resale checkout not found.")

    session = await _run_stripe_call(stripe.checkout.Session.retrieve, session_id)

    star = (await db.execute(select(Star).where(Star.id == sale.star_id))).scalars().first()
    return ResaleCheckoutStatusResponse(
        session_id=session_id,
        stripe_status=_stripe_value(session, "status") or "unknown",
        payment_status=_stripe_value(session, "payment_status"),
        sale_status=sale.status,
        fulfilled=sale.status == SALE_FULFILLED,
        sale_id=sale.id,
        listing_id=sale.listing_id,
        star_id=sale.star_id,
        star_name=_display_name(star) if star else "Star",
        amount=float(sale.amount),
        currency=sale.currency,
    )


async def handle_refund_event(db: AsyncSession, payment_intent_id: str | None, charge_id: str | None, amount_minor: int | None) -> None:
    if not payment_intent_id and not charge_id:
        return
    conditions = []
    if payment_intent_id:
        conditions.append(ResaleSale.stripe_payment_intent_id == payment_intent_id)
    if charge_id:
        conditions.append(ResaleSale.stripe_charge_id == charge_id)
    sale = (await db.execute(select(ResaleSale).where(or_(*conditions)).with_for_update())).scalars().first()
    if sale is None:
        return

    amount = _major_units(amount_minor or _minor_units(sale.amount))
    if _money(sale.refunded_amount or 0) >= amount and sale.status == SALE_REFUNDED:
        return
    sale.refunded_amount = _money(sale.refunded_amount or 0) + amount
    sale.status = SALE_REFUNDED
    sale.refunded_at = datetime.now(timezone.utc)
    star = (
        await db.execute(select(Star).where(Star.id == sale.star_id).with_for_update())
    ).scalars().first()
    if star and star.current_owner_user_id == sale.buyer_user_id:
        star.current_owner_user_id = sale.seller_user_id
        star.purchase_date = sale.refunded_at
        star.owner_name = None

    ledger = SellerBalanceLedger(
        user_id=sale.seller_user_id,
        resale_sale_id=sale.id,
        entry_type="refund",
        amount=-min(_money(sale.seller_proceeds_amount), amount),
        currency=sale.currency,
        status=LEDGER_REFUNDED,
        available_at=datetime.now(timezone.utc),
        entry_metadata={"charge_id": charge_id, "payment_intent_id": payment_intent_id},
    )
    db.add(ledger)
    await db.commit()


async def handle_payout_event(db: AsyncSession, payout_id: str | None, payout_status: str | None, failure_message: str | None = None) -> None:
    if not payout_id:
        return
    result = await db.execute(
        select(SellerBalanceLedger).where(SellerBalanceLedger.stripe_payout_id == payout_id)
    )
    entries = result.scalars().all()
    for entry in entries:
        entry.entry_metadata = {
            **(entry.entry_metadata or {}),
            "stripe_status": payout_status,
        }
        if failure_message:
            entry.error_message = failure_message
        if payout_status in {"failed", "canceled"}:
            entry.status = LEDGER_FAILED
        elif payout_status in {"paid", "in_transit", "pending"}:
            entry.status = LEDGER_WITHDRAWN
    await db.commit()
