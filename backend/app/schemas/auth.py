from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class GoogleLoginRequest(BaseModel):
    id_token: str


class CurrentUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    email_verified: bool
    full_name: str | None = None
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None = None


class AuthResponse(BaseModel):
    user: CurrentUserRead


class LogoutResponse(BaseModel):
    success: bool = True


class ProtectedExampleResponse(BaseModel):
    message: str
    user: CurrentUserRead
