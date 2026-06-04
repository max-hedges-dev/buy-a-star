from datetime import datetime

from pydantic import BaseModel

from app.schemas.star import StarDetailRead


class RegistrationPublicRead(BaseModel):
    id: int
    registration_number: str
    status: str
    registered_display_name: str
    dedication: str | None = None
    gift_message: str | None = None
    is_gift: bool
    claim_status: str
    public_page_slug: str
    public_page_visibility: str
    star: StarDetailRead


class RegistrationAccountRead(BaseModel):
    id: int
    transaction_id: int | None = None
    registration_number: str
    status: str
    purchaser_user_id: int
    current_holder_user_id: int | None = None
    registered_display_name: str
    dedication: str | None = None
    gift_message: str | None = None
    recipient_name: str | None = None
    recipient_email: str | None = None
    is_gift: bool
    claim_status: str
    claimed_at: datetime | None = None
    public_page_slug: str
    public_page_visibility: str
    ownership_history_visibility: str
    can_manage: bool
    can_claim: bool
    claim_url: str | None = None
    starwiki_url: str
    star: StarDetailRead


class RegistrationClaimPreviewRead(BaseModel):
    registration_id: int
    registration_number: str
    registered_display_name: str
    recipient_name: str | None = None
    gift_message: str | None = None
    dedication: str | None = None
    claim_status: str
    can_claim: bool
    starwiki_url: str
    star: StarDetailRead


class RegistrationClaimResult(BaseModel):
    registration_id: int
    claim_status: str
    current_holder_user_id: int
    starwiki_url: str
