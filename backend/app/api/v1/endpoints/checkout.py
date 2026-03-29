from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import stripe

from app.api.deps import require_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.checkout import (
    CheckoutSessionCreateRequest,
    CheckoutSessionCreateResponse,
    CheckoutSessionStatusResponse,
    CheckoutWebhookResponse,
)
from app.services.stripe_checkout import (
    _stripe_value,
    create_embedded_checkout_session,
    fulfill_checkout_session,
    mark_checkout_session_failed,
    mark_checkout_session_expired,
    retrieve_checkout_session,
)

router = APIRouter()


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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owner name is required.")

    client_secret, session_id = await create_embedded_checkout_session(
        db=db,
        star_id=payload.star_id,
        user=current_user,
        owner_name=payload.owner_name,
        includes_certificate=payload.include_certificate,
    )
    return CheckoutSessionCreateResponse(client_secret=client_secret, session_id=session_id)


@router.get("/session-status", response_model=CheckoutSessionStatusResponse)
async def session_status(
    session_id: str = Query(...),
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutSessionStatusResponse:
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
        star_id=fulfillment.star_id,
        star_name=fulfillment.star_name,
        owner_name=fulfillment.owner_name,
        includes_certificate=fulfillment.includes_certificate,
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

    if event_type in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
        await fulfill_checkout_session(db, event_object["id"])
    elif event_type == "checkout.session.expired":
        await mark_checkout_session_expired(db, event_object["id"])
    elif event_type == "checkout.session.async_payment_failed":
        await mark_checkout_session_failed(db, event_object["id"])

    return CheckoutWebhookResponse()
