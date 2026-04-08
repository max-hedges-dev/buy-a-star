from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.auth_session import AuthSession
from app.models.user import User


def _session_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=settings.SESSION_MAX_AGE_SECONDS)


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hmac.new(
        settings.SESSION_SECRET.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


async def create_user_session(db: AsyncSession, user: User) -> str:
    token = generate_session_token()
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=hash_session_token(token),
            expires_at=_session_expiry(),
        )
    )
    return token


async def get_user_for_session_token(db: AsyncSession, session_token: str | None) -> User | None:
    if not session_token:
        return None

    result = await db.execute(
        select(User, AuthSession)
        .join(AuthSession, AuthSession.user_id == User.id)
        .where(AuthSession.token_hash == hash_session_token(session_token))
    )
    row = result.first()
    if not row:
        return None

    user, session = row
    if session.expires_at <= datetime.now(timezone.utc):
        await db.delete(session)
        await db.commit()
        return None

    return user


async def revoke_session_token(db: AsyncSession, session_token: str | None) -> None:
    if not session_token:
        return

    await db.execute(
        delete(AuthSession).where(AuthSession.token_hash == hash_session_token(session_token))
    )
    await db.commit()
