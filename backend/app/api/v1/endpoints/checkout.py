from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import stripe

from app.api.deps import require_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.star import Star
from app.models.registration import Registration
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.checkout import (
    CheckoutOptionRead,
    CheckoutOptionsResponse,
    CheckoutSessionCreateRequest,
    CheckoutSessionCreateResponse,
    CheckoutSessionStatusResponse,
    CheckoutWebhookResponse,
)
from app.services.certificate_options import DEFAULT_CERTIFICATE_TYPE, certificate_label, list_certificate_options
from app.services.pricing import pricing_quote_for_country, star_price_for_country, SUPPORTED_COUNTRIES
from app.services.registration_records import build_claim_token
from app.services.stripe_checkout import (
    _stripe_value,
    complete_demo_checkout,
    create_embedded_checkout_session,
    fulfill_checkout_session,
    mark_checkout_session_failed,
    mark_checkout_session_expired,
    retrieve_checkout_session,
)

router = APIRouter()


@router.get("/options", response_model=CheckoutOptionsResponse)
async def checkout_options(
    country_code: str = Query("GB"),
    star_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> CheckoutOptionsResponse:
    quote = pricing_quote_for_country(country_code)
    star_price = quote.named_star_price
    if star_id is not None:
        result = await db.execute(select(Star).where(Star.id == star_id))
        star = result.scalars().first()
        if star is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Star not found.")
        star_price = star_price_for_country(star, quote.country_code)
    return CheckoutOptionsResponse(
        country_code=quote.country_code,
        default_certificate_type=DEFAULT_CERTIFICATE_TYPE,
        currency=quote.currency,
        supported_countries=SUPPORTED_COUNTRIES,
        star_price_minor_units=star_price.amount_minor_units,
        star_price=float(star_price.amount_major),
        options=[
            CheckoutOptionRead(
                code=option.code,
                label=option.label,
                description=option.description,
                price_minor_units=quote.certificate_prices[option.code].amount_minor_units,
                price=float(quote.certificate_prices[option.code].amount_major),
                shipping_required=option.shipping_required,
                shipping_amount_minor_units=quote.shipping_price.amount_minor_units if option.shipping_required else 0,
                shipping_amount=float(quote.shipping_price.amount_major) if option.shipping_required else 0,
            )
            for option in list_certificate_options()
        ],
    )


@router.post("/session", response_model=CheckoutSessionCreateResponse)
async def create_session(
    payload: CheckoutSessionCreateRequest,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutSessionCreateResponse:
    if not payload.accepted_terms:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You must accept the Terms & Conditions.")
    if not payload.accepted_privacy:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You must accept the Privacy Notice.")
    if not payload.owner_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registered display name is required.")
    if payload.registration_type not in {"self", "gift", "decide_later"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid registration type.")
    if payload.registration_type == "gift" and not (payload.recipient_name or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipient name is required for a gift registration.")

    try:
        client_secret, session_id = await create_embedded_checkout_session(
            db=db,
            star_id=payload.star_id,
            user=current_user,
            owner_name=payload.owner_name,
            registration_type=payload.registration_type,
            recipient_name=payload.recipient_name,
            recipient_email=payload.recipient_email,
            dedication=payload.dedication,
            gift_message=payload.gift_message,
            certificate_type=payload.certificate_type,
            country_code=payload.country_code,
        )
    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.user_message or str(exc),
        ) from exc
    return CheckoutSessionCreateResponse(client_secret=client_secret, session_id=session_id)


@router.post("/demo-complete", response_model=CheckoutSessionStatusResponse)
async def complete_demo_session(
    payload: CheckoutSessionCreateRequest,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutSessionStatusResponse:
    if not (settings.DEMO_MODE and settings.ALLOW_DEMO_CHECKOUT):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Demo checkout is not enabled for this environment.")
    if not payload.accepted_terms:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You must accept the Terms & Conditions.")
    if not payload.accepted_privacy:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You must accept the Privacy Notice.")
    if not payload.owner_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registered display name is required.")
    if payload.registration_type not in {"self", "gift", "decide_later"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid registration type.")
    if payload.registration_type == "gift" and not (payload.recipient_name or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipient name is required for a gift registration.")

    fulfillment = await complete_demo_checkout(
        db=db,
        star_id=payload.star_id,
        user=current_user,
        owner_name=payload.owner_name,
        registration_type=payload.registration_type,
        recipient_name=payload.recipient_name,
        recipient_email=payload.recipient_email,
        dedication=payload.dedication,
        gift_message=payload.gift_message,
        certificate_type=payload.certificate_type,
        country_code=payload.country_code,
    )
    return CheckoutSessionStatusResponse(
        session_id=f"demo-{fulfillment.transaction_id}",
        status="complete",
        payment_status="demo_paid",
        transaction_status=fulfillment.transaction_status,
        fulfilled=fulfillment.fulfilled,
        transaction_id=fulfillment.transaction_id,
        registration_id=fulfillment.registration_id,
        public_page_slug=fulfillment.public_page_slug,
        registration_number=fulfillment.registration_number,
        star_id=fulfillment.star_id,
        star_name=fulfillment.star_name,
        owner_name=fulfillment.owner_name,
        registration_type=fulfillment.registration_type,
        recipient_name=fulfillment.recipient_name,
        claim_status=fulfillment.claim_status,
        claim_url=fulfillment.claim_url,
        is_demo=fulfillment.is_demo,
        includes_certificate=fulfillment.includes_certificate,
        certificate_type=fulfillment.certificate_type,
        certificate_label=fulfillment.certificate_label,
        shipping_required=fulfillment.shipping_required,
        shipping_amount_total=None,
        amount_total=None,
        currency="gbp",
    )


@router.get("/session-status", response_model=CheckoutSessionStatusResponse)
async def session_status(
    session_id: str = Query(...),
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutSessionStatusResponse:
    if session_id.startswith("demo-"):
        try:
            transaction_id = int(session_id.removeprefix("demo-"))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checkout session not found.") from exc

        result = await db.execute(
            select(Transaction, Star, Registration)
            .join(Star, Star.id == Transaction.star_id)
            .outerjoin(Registration, Registration.transaction_id == Transaction.id)
            .where(Transaction.id == transaction_id, Transaction.user_id == current_user.id, Transaction.is_demo.is_(True))
        )
        row = result.first()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checkout session not found.")

        transaction, star, registration = row
        return CheckoutSessionStatusResponse(
            session_id=session_id,
            status="complete",
            payment_status=transaction.payment_status,
            transaction_status=transaction.status,
            fulfilled=True,
            transaction_id=transaction.id,
            registration_id=registration.id if registration else None,
            public_page_slug=registration.public_page_slug if registration else None,
            registration_number=transaction.registration_number,
            star_id=star.id,
            star_name=star.common_name or star.display_name or star.scientific_name,
            owner_name=transaction.owner_name,
            registration_type=transaction.registration_type,
            recipient_name=transaction.recipient_name,
            claim_status=registration.claim_status if registration else None,
            claim_url=f"/claim/{build_claim_token(registration.id)}" if registration and registration.claim_status == "claimable" else None,
            is_demo=True,
            includes_certificate=transaction.includes_certificate,
            certificate_type=transaction.certificate_type,
            certificate_label=certificate_label(transaction.certificate_type),
            shipping_required=transaction.shipping_required,
            shipping_amount_total=None,
            amount_total=None,
            currency=transaction.currency,
        )

    result = await db.execute(
        select(Transaction).where(
            Transaction.stripe_checkout_session_id == session_id,
            Transaction.user_id == current_user.id,
        )
    )
    transaction = result.scalars().first()

    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checkout session not found.")

    session = await retrieve_checkout_session(session_id)
    fulfillment = await fulfill_checkout_session(db, session_id)

    return CheckoutSessionStatusResponse(
        session_id=session_id,
        status=_stripe_value(session, "status") or "unknown",
        payment_status=_stripe_value(session, "payment_status"),
        transaction_status=fulfillment.transaction_status,
        fulfilled=fulfillment.fulfilled,
        transaction_id=fulfillment.transaction_id,
        registration_id=fulfillment.registration_id,
        public_page_slug=fulfillment.public_page_slug,
        registration_number=fulfillment.registration_number,
        star_id=fulfillment.star_id,
        star_name=fulfillment.star_name,
        owner_name=fulfillment.owner_name,
        registration_type=fulfillment.registration_type,
        recipient_name=fulfillment.recipient_name,
        claim_status=fulfillment.claim_status,
        claim_url=fulfillment.claim_url,
        is_demo=fulfillment.is_demo,
        includes_certificate=fulfillment.includes_certificate,
        certificate_type=fulfillment.certificate_type,
        certificate_label=fulfillment.certificate_label,
        shipping_required=fulfillment.shipping_required,
        shipping_amount_total=_stripe_value(_stripe_value(session, "shipping_cost"), "amount_total"),
        amount_total=_stripe_value(session, "amount_total"),
        currency=_stripe_value(session, "currency"),
    )


@router.post("/webhook", response_model=CheckoutWebhookResponse)
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> CheckoutWebhookResponse:
    payload = await request.body()
    signature = request.headers.get("Stripe-Signature")

    if settings.STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(
                payload=payload,
                sig_header=signature,
                secret=settings.STRIPE_WEBHOOK_SECRET,
            )
        except (ValueError, stripe.error.SignatureVerificationError) as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe webhook signature.") from exc
    else:
        event = stripe.Event.construct_from(await request.json(), stripe.api_key)

    event_type = event["type"]
    event_object = event["data"]["object"]

    metadata = _stripe_value(event_object, "metadata", {}) or {}
    if event_type in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
        await fulfill_checkout_session(db, event_object["id"])
    elif event_type == "checkout.session.expired":
        await mark_checkout_session_expired(db, event_object["id"])
    elif event_type == "checkout.session.async_payment_failed":
        await mark_checkout_session_failed(db, event_object["id"])

    return CheckoutWebhookResponse()
