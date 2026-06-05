from dataclasses import dataclass
import base64
import json

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


def _base64url_decode(value: str) -> bytes:
    padding = '=' * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _decode_unverified_google_token(token: str) -> dict:
    try:
        header_segment, payload_segment, _signature_segment = token.split(".", 2)
        del header_segment
        payload = json.loads(_base64url_decode(payload_segment).decode("utf-8"))
    except Exception as exc:
        raise GoogleTokenVerificationError("The Google ID token could not be decoded.") from exc

    audience = payload.get("aud")
    if audience != settings.GOOGLE_CLIENT_ID:
        raise GoogleTokenVerificationError("The Google ID token audience does not match this app.")

    return payload


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
    except Exception as exc:
        if settings.APP_ENV == "production":
            raise GoogleTokenVerificationError("Google sign-in could not be verified right now.") from exc
        payload = _decode_unverified_google_token(token)

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
