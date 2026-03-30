from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CheckoutSessionCreateRequest(BaseModel):
    star_id: int
    owner_name: str
    include_certificate: bool = True
    accepted_terms: bool
    accepted_privacy: bool


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
    registration_number: str | None = None
    star_id: int
    star_name: str
    owner_name: str | None = None
    includes_certificate: bool
    amount_total: int | None = None
    currency: str | None = None


class CheckoutWebhookResponse(BaseModel):
    received: bool = True


class CheckoutFulfillmentResult(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    fulfilled: bool
    transaction_status: str
    transaction_id: int
    registration_number: str | None = None
    star_id: int
    star_name: str
    owner_name: str | None = None
    includes_certificate: bool
    fulfilled_at: datetime | None = None
