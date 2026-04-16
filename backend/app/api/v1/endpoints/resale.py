from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.resale import (
    ResaleCheckoutCreateResponse,
    ResaleCheckoutStatusResponse,
    ResaleListingCreateRequest,
    ResaleListingRead,
    SellerBalanceRead,
    SellerOnboardingLinkRead,
    SellerStatusRead,
    WithdrawalCreateRequest,
    WithdrawalCreateResponse,
)
from app.services.stripe_resale import (
    cancel_listing,
    create_listing,
    create_resale_checkout_session,
    create_seller_dashboard_link,
    create_seller_onboarding_link,
    create_withdrawal,
    listing_read,
    read_seller_balance,
    resale_checkout_status,
    sync_seller_account_status,
)

router = APIRouter()


@router.get("/seller/status", response_model=SellerStatusRead)
async def seller_status(
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> SellerStatusRead:
    status = await sync_seller_account_status(current_user)
    await db.commit()
    return status


@router.post("/seller/onboarding-link", response_model=SellerOnboardingLinkRead)
async def seller_onboarding_link(
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> SellerOnboardingLinkRead:
    url, seller = await create_seller_onboarding_link(db, current_user)
    return SellerOnboardingLinkRead(url=url, seller=seller)


@router.post("/seller/dashboard-link")
async def seller_dashboard_link(
    current_user: User = Depends(require_current_user),
) -> dict[str, str]:
    return {"url": await create_seller_dashboard_link(current_user)}


@router.post("/listings", response_model=ResaleListingRead)
async def create_resale_listing(
    payload: ResaleListingCreateRequest,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResaleListingRead:
    listing = await create_listing(
        db=db,
        user=current_user,
        star_id=payload.star_id,
        price=payload.price,
        currency=payload.currency,
    )
    return listing_read(listing)


@router.delete("/listings/{listing_id}", response_model=ResaleListingRead)
async def cancel_resale_listing(
    listing_id: int,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResaleListingRead:
    listing = await cancel_listing(db, current_user, listing_id)
    return listing_read(listing)


@router.post("/listings/{listing_id}/checkout", response_model=ResaleCheckoutCreateResponse)
async def create_listing_checkout(
    listing_id: int,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResaleCheckoutCreateResponse:
    client_secret, session_id = await create_resale_checkout_session(db, current_user, listing_id)
    return ResaleCheckoutCreateResponse(client_secret=client_secret, session_id=session_id)


@router.get("/session-status", response_model=ResaleCheckoutStatusResponse)
async def read_resale_session_status(
    session_id: str = Query(...),
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResaleCheckoutStatusResponse:
    return await resale_checkout_status(db, session_id, current_user)


@router.get("/balance", response_model=SellerBalanceRead)
async def seller_balance(
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> SellerBalanceRead:
    return await read_seller_balance(db, current_user)


@router.post("/withdraw", response_model=WithdrawalCreateResponse)
async def withdraw_balance(
    payload: WithdrawalCreateRequest,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
) -> WithdrawalCreateResponse:
    try:
        payout_id, amount, payout_status = await create_withdrawal(
            db,
            current_user,
            payload.amount,
            payload.currency,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return WithdrawalCreateResponse(
        payout_id=payout_id,
        amount=float(amount),
        currency=payload.currency.lower(),
        status=payout_status,
    )
