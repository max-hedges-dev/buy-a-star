from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.services.session_auth import get_user_for_session_token


async def get_session_token(
    session_token: str | None = Cookie(default=None, alias=settings.SESSION_COOKIE_NAME),
) -> str | None:
    return session_token


async def get_current_user_optional(
    session_token: str | None = Depends(get_session_token),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    return await get_user_for_session_token(db, session_token)


async def require_current_user(
    current_user: User | None = Depends(get_current_user_optional),
) -> User:
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    return current_user
