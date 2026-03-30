from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        env_ignore_empty=True,
    )

    PROJECT_NAME: str = "Aster Atlas"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost/buyastar"
    GOOGLE_CLIENT_ID: str = ""
    SESSION_SECRET: str = "dev-only-session-secret-change-me"
    FRONTEND_ORIGIN: str = "http://127.0.0.1:5173,http://localhost:5173"
    BACKEND_ORIGIN: str = "http://127.0.0.1:8000"
    SESSION_COOKIE_NAME: str = "aster_atlas_session"
    SESSION_MAX_AGE_SECONDS: int = 60 * 60 * 24 * 14
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_CURRENCY: str = "gbp"
    STRIPE_DIGITAL_CERTIFICATE_PRICE_GBP: int = 0
    STRIPE_A4_PAPER_CERTIFICATE_PRICE_GBP: int = 599
    STRIPE_A4_LAMINATED_PAPER_CERTIFICATE_PRICE_GBP: int = 899
    STRIPE_A4_CARD_CERTIFICATE_PRICE_GBP: int = 799
    STRIPE_NAMED_STAR_PRICE_GBP: int = 1899
    STRIPE_UNNAMED_STAR_PRICE_GBP: int = 1599
    STRIPE_UK_SHIPPING_RATE_GBP: int = 199
    STRIPE_US_SHIPPING_RATE_GBP: int = 299
    STRIPE_EUROPE_SHIPPING_RATE_GBP: int = 299
    STRIPE_REST_OF_WORLD_SHIPPING_RATE_GBP: int = 399
    STRIPE_DEFAULT_COUNTRY_CODE: str = "GB"

    @field_validator("FRONTEND_ORIGIN", "BACKEND_ORIGIN", mode="before")
    @classmethod
    def normalize_origins(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.FRONTEND_ORIGIN.split(",") if origin.strip()]

    @property
    def session_cookie_secure(self) -> bool:
        return self.BACKEND_ORIGIN.startswith("https://")

settings = Settings()
