from datetime import datetime

from pydantic import BaseModel


class AccountStarSummary(BaseModel):
    id: int
    display_name: str
    scientific_name: str
    owner_name: str | None = None
    category: str
    price: float | None = None
    constellation: str | None = None
    distance_ly: float
    spectral_type: str | None = None
    purchase_date: datetime | None = None
    registration_number: str | None = None
    is_current_owner: bool = True


class AccountOrderSummary(BaseModel):
    id: int
    registration_number: str | None = None
    status: str
    owner_name: str | None = None
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
    star: AccountStarSummary


class AccountOrderDetail(AccountOrderSummary):
    certificate_available: bool


class AccountOverviewResponse(BaseModel):
    orders: list[AccountOrderSummary]
    stars: list[AccountStarSummary]
