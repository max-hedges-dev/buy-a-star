from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional, get_session_token, require_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    CurrentUserRead,
    GoogleLoginRequest,
    LogoutResponse,
    ProtectedExampleResponse,
)
from app.services.google_auth import GoogleTokenVerificationError, verify_google_identity_token
from app.services.session_auth import create_user_session, revoke_session_token

router = APIRouter()


def _set_session_cookie(response: Response, session_token: str) -> None:
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")


@router.post("/google", response_model=AuthResponse)
async def sign_in_with_google(
    payload: GoogleLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    try:
        identity = verify_google_identity_token(payload.id_token)
    except GoogleTokenVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    result = await db.execute(select(User).where(User.google_sub == identity.sub))
    user = result.scalars().first()

    if user is None:
        email_match = await db.execute(select(User).where(User.email == identity.email))
        user = email_match.scalars().first()

    now = datetime.now(timezone.utc)

    if user is None:
        user = User(
            google_sub=identity.sub,
            email=identity.email,
            email_verified=identity.email_verified,
            full_name=identity.name,
            avatar_url=identity.picture,
            last_login_at=now,
        )
        db.add(user)
    else:
        user.google_sub = identity.sub
        user.email = identity.email
        user.email_verified = identity.email_verified
        user.full_name = identity.name
        user.avatar_url = identity.picture
        user.last_login_at = now

    await db.flush()
    session_token = await create_user_session(db, user)
    await db.commit()
    await db.refresh(user)

    _set_session_cookie(response, session_token)
    return AuthResponse(user=CurrentUserRead.model_validate(user))


@router.get("/me", response_model=AuthResponse)
async def read_current_user(
    current_user: User | None = Depends(get_current_user_optional),
) -> AuthResponse:
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No active session.",
        )

    return AuthResponse(user=CurrentUserRead.model_validate(current_user))


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    response: Response,
    session_token: str | None = Depends(get_session_token),
    db: AsyncSession = Depends(get_db),
) -> LogoutResponse:
    await revoke_session_token(db, session_token)
    _clear_session_cookie(response)
    return LogoutResponse()


@router.get("/protected", response_model=ProtectedExampleResponse)
async def protected_example(
    current_user: User = Depends(require_current_user),
) -> ProtectedExampleResponse:
    return ProtectedExampleResponse(
        message="Protected route access granted. Your app session is active.",
        user=CurrentUserRead.model_validate(current_user),
    )
