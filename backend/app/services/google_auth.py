from dataclasses import dataclass

from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token as google_id_token

from app.core.config import settings


@dataclass
class GoogleIdentity:
    sub: str
    email: str
    email_verified: bool
    name: str | None
    picture: str | None


class GoogleTokenVerificationError(Exception):
    pass


def verify_google_identity_token(token: str) -> GoogleIdentity:
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleTokenVerificationError("Google auth is not configured on the backend.")

    try:
        payload = google_id_token.verify_oauth2_token(
            token,
            GoogleRequest(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise GoogleTokenVerificationError("The Google ID token is invalid or expired.") from exc

    issuer = payload.get("iss")
    if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
        raise GoogleTokenVerificationError("The Google ID token issuer is not trusted.")

    sub = payload.get("sub")
    email = payload.get("email")

    if not sub or not email:
        raise GoogleTokenVerificationError("The Google ID token did not include the required profile claims.")

    email_verified = payload.get("email_verified", False)
    if isinstance(email_verified, str):
        email_verified = email_verified.lower() == "true"

    return GoogleIdentity(
        sub=sub,
        email=email.lower(),
        email_verified=bool(email_verified),
        name=payload.get("name"),
        picture=payload.get("picture"),
    )
