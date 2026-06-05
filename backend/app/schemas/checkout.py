from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CartUpsertRequest(BaseModel):
    star_id: int
    registration_type: str = "self"
    owner_name: str
    recipient_name: str | None = None
    recipient_email: str | None = None
    dedication: str | None = None
    gift_message: str | None = None
    certificate_type: str = "digital"
    country_code: str = "GB"


class CheckoutSessionCreateRequest(BaseModel):
    star_id: int
    registration_type: str = "self"
    owner_name: str
    recipient_name: str | None = None
    recipient_email: str | None = None
    dedication: str | None = None
    gift_message: str | None = None
    certificate_type: str = "digital"
    country_code: str = "GB"
    accepted_terms: bool
    accepted_privacy: bool


class CheckoutOptionRead(BaseModel):
    code: str
    label: str
    description: str
    price_minor_units: int
    price: float
    shipping_required: bool
    shipping_amount_minor_units: int
    shipping_amount: float


class CheckoutOptionsResponse(BaseModel):
    country_code: str
    default_certificate_type: str
    currency: str
    supported_countries: list[str]
    star_price_minor_units: int
    star_price: float
    options: list[CheckoutOptionRead]


class CheckoutSessionCreateResponse(BaseModel):
    client_secret: str
    session_id: str


class CheckoutSessionStatusResponse(BaseModel):
    session_id: str
    status: str
    payment_status: str | None = None
    transaction_status: str
    fulfilled: bool
    transaction_id: int
    registration_id: int | None = None
    public_page_slug: str | None = None
    registration_number: str | None = None
    star_id: int
    star_name: str
    owner_name: str | None = None
    registration_type: str = "self"
    recipient_name: str | None = None
    claim_status: str | None = None
    claim_url: str | None = None
    is_demo: bool = False
    includes_certificate: bool
    certificate_type: str
    certificate_label: str
    shipping_required: bool
    shipping_amount_total: int | None = None
    amount_total: int | None = None
    currency: str | None = None


class CheckoutWebhookResponse(BaseModel):
    received: bool = True


class CheckoutFulfillmentResult(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    fulfilled: bool
    transaction_status: str
    transaction_id: int
    registration_id: int | None = None
    public_page_slug: str | None = None
    registration_number: str | None = None
    star_id: int
    star_name: str
    owner_name: str | None = None
    registration_type: str = "self"
    recipient_name: str | None = None
    claim_status: str | None = None
    claim_url: str | None = None
    is_demo: bool = False
    includes_certificate: bool
    certificate_type: str
    certificate_label: str
    shipping_required: bool
    fulfilled_at: datetime | None = None


class CartItemResponse(BaseModel):
    transaction_id: int
    star_id: int
    star_name: str
    owner_name: str | None = None
    registration_type: str = "self"
    recipient_name: str | None = None
    hold_expires_at: datetime | None = None
    hold_active: bool = False
    status: str
