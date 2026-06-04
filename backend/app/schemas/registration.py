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
    is_demo: bool = False
    claim_status: str
    public_page_slug: str
    public_page_visibility: str
    current_holder_username: str | None = None
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
    is_demo: bool = False
    claim_status: str
    claimed_at: datetime | None = None
    public_page_slug: str
    public_page_visibility: str
    ownership_history_visibility: str
    current_holder_username: str | None = None
    can_manage: bool
    can_claim: bool
    can_prepare_claim: bool = False
    claim_url: str | None = None
    starwiki_url: str
    star: StarDetailRead


class RegistrationClaimPreviewRead(BaseModel):
    registration_id: int
    registration_number: str
    registered_display_name: str
    recipient_name: str | None = None
    purchaser_name: str | None = None
    gift_message: str | None = None
    dedication: str | None = None
    claim_status: str
    current_holder_username: str | None = None
    can_claim: bool
    is_demo: bool = False
    starwiki_url: str
    star: StarDetailRead


class RegistrationClaimResult(BaseModel):
    registration_id: int
    transaction_id: int | None = None
    claim_status: str
    current_holder_user_id: int
    starwiki_url: str
