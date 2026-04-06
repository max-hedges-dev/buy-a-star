import json

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
    STRIPE_NAMED_STAR_PRICE_GBP: int = 1499
    STRIPE_UNNAMED_STAR_PRICE_GBP: int = 1499
    STRIPE_UK_SHIPPING_RATE_GBP: int = 199
    STRIPE_US_SHIPPING_RATE_GBP: int = 299
    STRIPE_EUROPE_SHIPPING_RATE_GBP: int = 299
    STRIPE_REST_OF_WORLD_SHIPPING_RATE_GBP: int = 399
    STRIPE_DEFAULT_COUNTRY_CODE: str = "GB"
    STAR_ISSUE_PRICE: float = 14.99
    STAR_VALUATION_PROVIDER: str = "fred"
    STAR_VALUATION_ENERGY_SYMBOL: str = "DCOILWTICO"
    STAR_VALUATION_METALS_SYMBOL: str = "METALS_BASKET"
    STAR_VALUATION_METALS_IRON_ORE_SYMBOL: str = "PIORECRUSDM"
    STAR_VALUATION_METALS_COPPER_SYMBOL: str = "PCOPPUSDM"
    STAR_VALUATION_METALS_SILVER_SYMBOL: str = "IP7106"
    STAR_VALUATION_METALS_GOLD_SYMBOL: str = "IP7108"
    STAR_VALUATION_METALS_IRON_ORE_WEIGHT: float = 0.50
    STAR_VALUATION_METALS_COPPER_WEIGHT: float = 0.30
    STAR_VALUATION_METALS_SILVER_WEIGHT: float = 0.10
    STAR_VALUATION_METALS_GOLD_WEIGHT: float = 0.10
    STAR_VALUATION_METALS_SMOOTHING_DAYS: int = 5
    STAR_VALUATION_HISTORY_BOOTSTRAP_DAYS: int = 30
    STAR_VALUATION_MARKET_LOOKBACK_DAYS: int = 45
    STAR_VALUATION_SCHEDULE_ENABLED: bool = True
    STAR_VALUATION_SCHEDULE_TIMEZONE: str = "Europe/London"
    STAR_VALUATION_SCHEDULE_HOUR: int = 23
    STAR_VALUATION_SCHEDULE_MINUTE: int = 30
    STAR_VALUATION_MIN_VALUE_FLOOR_MULTIPLIER: float = 0.65
    STAR_VALUATION_BASELINE_MIN_MULTIPLIER: float = 0.82
    STAR_VALUATION_BASELINE_MAX_MULTIPLIER: float = 1.48
    STAR_VALUATION_ENERGY_IMPACT_MULTIPLIER: float = 0.35
    STAR_VALUATION_METALS_IMPACT_MULTIPLIER: float = 0.25
    STAR_VALUATION_BRIGHTNESS_WEIGHT: float = 0.20
    STAR_VALUATION_PARALLAX_WEIGHT: float = 0.15
    STAR_VALUATION_NON_SINGLE_WEIGHT: float = 0.10
    STAR_VALUATION_VARIABLE_WEIGHT: float = 0.08
    STAR_VALUATION_CLASS_WEIGHT: float = 0.07
    STAR_VALUATION_RADIUS_WEIGHT: float = 0.10
    STAR_VALUATION_AGE_WEIGHT: float = 0.10
    STAR_VALUATION_LUMINOSITY_WEIGHT: float = 0.15
    STAR_VALUATION_TEMPERATURE_WEIGHT: float = 0.10
    STAR_VALUATION_METALLICITY_WEIGHT: float = 0.15
    STAR_VALUATION_CLASS_PREMIUMS_JSON: str = (
        '{"MIRA":0.95,"MIRA_SR":0.9,"RRAB":0.82,"RRC":0.74,"DSCT_SXPHE":0.68,'
        '"EA":0.62,"EB":0.58,"EW":0.56,"ROT":0.52,"SOLAR_LIKE":0.5,"UNKNOWN":0.4}'
    )

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

    @property
    def star_valuation_class_premiums(self) -> dict[str, float]:
        try:
            parsed = json.loads(self.STAR_VALUATION_CLASS_PREMIUMS_JSON)
        except json.JSONDecodeError:
            return {}
        return {
            str(key).upper(): float(value)
            for key, value in parsed.items()
        }

settings = Settings()
