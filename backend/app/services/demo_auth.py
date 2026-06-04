from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User


@dataclass(frozen=True)
class DemoProfile:
    role: str
    email: str
    name: str
    username: str


DEMO_PROFILES: dict[str, DemoProfile] = {
    "user1": DemoProfile(role="user1", email="demo-user-1@asteratlas.demo", name="Demo User 1", username="Styles"),
    "user2": DemoProfile(role="user2", email="demo-user-2@asteratlas.demo", name="Demo User 2", username="Stray"),
    "guest": DemoProfile(role="guest", email="demo-guest@asteratlas.demo", name="Demo Guest", username="Guest"),
}


def ensure_demo_auth_allowed() -> None:
    if not (settings.DEMO_MODE and settings.ALLOW_DEMO_AUTH):
        raise PermissionError("Demo sign-in is not enabled for this environment.")


async def get_or_create_demo_user(db: AsyncSession, role: str) -> User:
    ensure_demo_auth_allowed()
    normalized_role = (role or "").strip().lower()
    if normalized_role == "collector":
        normalized_role = "user1"
    if normalized_role == "buyer":
        normalized_role = "user1"
    if normalized_role == "recipient":
        normalized_role = "user2"
    profile = DEMO_PROFILES.get(normalized_role)
    if profile is None:
        raise ValueError("Unknown demo role.")

    result = await db.execute(select(User).where(User.email == profile.email))
    user = result.scalars().first()
    now = datetime.now(timezone.utc)

    if user is None:
        user = User(
            google_sub=f"demo:{profile.role}",
            email=profile.email,
            email_verified=True,
            full_name=profile.name,
            username=profile.username,
            avatar_url=None,
            is_demo=True,
            demo_role=profile.role,
            last_login_at=now,
        )
        db.add(user)
    else:
        user.google_sub = user.google_sub or f"demo:{profile.role}"
        user.email_verified = True
        user.full_name = profile.name
        user.username = profile.username
        user.is_demo = True
        user.demo_role = profile.role
        user.last_login_at = now

    await db.flush()
    return user
