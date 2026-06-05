from datetime import datetime

from pydantic import BaseModel


class AccountStarSummary(BaseModel):
    id: int
    star_slug: str | None = None
    registration_id: int | None = None
    transaction_id: int | None = None
    public_page_slug: str | None = None
    display_name: str
    scientific_name: str
    owner_name: str | None = None
    owner_username: str | None = None
    recipient_name: str | None = None
    dedication: str | None = None
    current_holder_label: str | None = None
    current_holder_username: str | None = None
    claim_status: str | None = None
    status: str | None = None
    is_gift: bool = False
    is_demo: bool = False
    category: str
    price: float | None = None
    constellation: str | None = None
    distance_ly: float
    spectral_type: str | None = None
    purchase_date: datetime | None = None
    registration_number: str | None = None
    is_current_owner: bool = True
    is_bought: bool = False
    active_hold_expires_at: datetime | None = None
    held_in_another_cart: bool = False
    hold_owner_name: str | None = None


class AccountOrderSummary(BaseModel):
    id: int
    registration_id: int | None = None
    public_page_slug: str | None = None
    registration_number: str | None = None
    status: str
    owner_name: str | None = None
    recipient_name: str | None = None
    recipient_email: str | None = None
    dedication: str | None = None
    gift_message: str | None = None
    registration_type: str = "self"
    claim_status: str | None = None
    is_gift: bool = False
    is_demo: bool = False
    amount: float
    currency: str
    includes_certificate: bool
    certificate_type: str
    certificate_label: str
    shipping_required: bool
    shipping_amount: float
    transaction_type: str = "primary"
    created_at: datetime | None = None
    fulfilled_at: datetime | None = None
    hold_expires_at: datetime | None = None
    hold_active: bool = False
    can_proceed_to_payment: bool = False
    is_star_still_available: bool = True
    star: AccountStarSummary


class AccountOrderDetail(AccountOrderSummary):
    certificate_available: bool


class AccountOverviewResponse(BaseModel):
    orders: list[AccountOrderSummary]
    cart_items: list[AccountOrderSummary]
    stars: list[AccountStarSummary]
