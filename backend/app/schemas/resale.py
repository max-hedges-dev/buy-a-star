from datetime import datetime

from pydantic import BaseModel, Field


class SellerStatusRead(BaseModel):
    connected_account_id: str | None = None
    onboarding_status: str
    charges_enabled: bool = False
    payouts_enabled: bool = False
    details_submitted: bool = False
    requirements_due: list[str] = Field(default_factory=list)
    can_receive_resale_payments: bool = False
    can_withdraw: bool = False


class SellerOnboardingLinkRead(BaseModel):
    url: str
    seller: SellerStatusRead


class ResaleListingCreateRequest(BaseModel):
    star_id: int
    price: float
    currency: str = "gbp"


class ResaleListingRead(BaseModel):
    id: int
    star_id: int
    seller_user_id: int
    price: float
    currency: str
    status: str
    created_at: datetime | None = None
    expires_at: datetime | None = None
    sold_at: datetime | None = None


class ResaleCheckoutCreateResponse(BaseModel):
    client_secret: str
    session_id: str


class ResaleCheckoutStatusResponse(BaseModel):
    session_id: str
    stripe_status: str
    payment_status: str | None = None
    sale_status: str
    fulfilled: bool
    sale_id: int
    listing_id: int
    star_id: int
    star_name: str
    amount: float
    currency: str


class SellerLedgerEntryRead(BaseModel):
    id: int
    resale_sale_id: int | None = None
    entry_type: str
    amount: float
    currency: str
    status: str
    available_at: datetime | None = None
    stripe_payout_id: str | None = None
    error_message: str | None = None
    created_at: datetime | None = None


class SellerBalanceRead(BaseModel):
    pending_balance: float
    available_balance: float
    currency: str = "gbp"
    entries: list[SellerLedgerEntryRead]
    seller: SellerStatusRead


class WithdrawalCreateRequest(BaseModel):
    amount: float
    currency: str = "gbp"


class WithdrawalCreateResponse(BaseModel):
    payout_id: str
    amount: float
    currency: str
    status: str
