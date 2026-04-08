from datetime import datetime

from pydantic import BaseModel


class AccountStarSummary(BaseModel):
    id: int
    display_name: str
    scientific_name: str
    owner_name: str | None = None
    category: str
    constellation: str | None = None
    distance_ly: float
    spectral_type: str | None = None
    purchase_date: datetime | None = None
    registration_number: str | None = None
    ask_price: float | None = None
    model_value: float | None = None


class AccountStarPriceUpdateRequest(BaseModel):
    ask_price: float | None = None


class AccountStarPriceUpdateResponse(BaseModel):
    star_id: int
    ask_price: float | None = None
    model_value: float | None = None


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
    created_at: datetime | None = None
    fulfilled_at: datetime | None = None
    star: AccountStarSummary


class AccountOrderDetail(AccountOrderSummary):
    certificate_available: bool


class AccountOverviewResponse(BaseModel):
    orders: list[AccountOrderSummary]
    stars: list[AccountStarSummary]
