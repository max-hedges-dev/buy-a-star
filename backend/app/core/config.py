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
    STRIPE_RESALE_PLATFORM_FEE_PERCENT: float = 7.5
    STRIPE_RESALE_PLATFORM_FEE_FLAT_GBP: int = 0
    STRIPE_RESALE_BALANCE_HOLD_DAYS: int = 2
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
    STAR_VALUATION_BASELINE_MIN_MULTIPLIER: float = 0.65
    STAR_VALUATION_BASELINE_MAX_MULTIPLIER: float = 2.35
    STAR_VALUATION_ENERGY_IMPACT_MULTIPLIER: float = 0.52
    STAR_VALUATION_METALS_IMPACT_MULTIPLIER: float = 0.42
    STAR_VALUATION_COOLNESS_CAP: float = 4.6
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
    STAR_VALUATION_LIFETIME_ENERGY_MARKET_WEIGHT: float = 0.18
    STAR_VALUATION_ENERGY_SENSITIVITY_MAX_BOOST: float = 0.75
    STAR_VALUATION_METALS_SENSITIVITY_MAX_BOOST: float = 0.85
    STAR_VALUATION_COOLNESS_MILD_THRESHOLD: float = 0.85
    STAR_VALUATION_COOLNESS_CLEAR_THRESHOLD: float = 0.93
    STAR_VALUATION_COOLNESS_VERY_RARE_THRESHOLD: float = 0.98
    STAR_VALUATION_COOLNESS_EXTREME_THRESHOLD: float = 0.995
    STAR_VALUATION_COOLNESS_MILD_BONUS: float = 0.10
    STAR_VALUATION_COOLNESS_CLEAR_BONUS: float = 0.24
    STAR_VALUATION_COOLNESS_VERY_RARE_BONUS: float = 0.55
    STAR_VALUATION_COOLNESS_EXTREME_BONUS: float = 1.25
    STAR_VALUATION_COOLNESS_COLOR_WEIGHT: float = 0.014
    STAR_VALUATION_COOLNESS_PROPER_MOTION_WEIGHT: float = 0.014
    STAR_VALUATION_COOLNESS_RADIAL_VELOCITY_WEIGHT: float = 0.011
    STAR_VALUATION_COOLNESS_TEMPERATURE_WEIGHT: float = 0.011
    STAR_VALUATION_COOLNESS_RADIUS_WEIGHT: float = 0.018
    STAR_VALUATION_COOLNESS_LUMINOSITY_WEIGHT: float = 0.022
    STAR_VALUATION_COOLNESS_MASS_WEIGHT: float = 0.018
    STAR_VALUATION_COOLNESS_AGE_WEIGHT: float = 0.012
    STAR_VALUATION_COOLNESS_EVOLSTAGE_WEIGHT: float = 0.012
    STAR_VALUATION_COOLNESS_BINARY_WEIGHT: float = 0.010
    STAR_VALUATION_COOLNESS_LIFETIME_ENERGY_WEIGHT: float = 0.032
    STAR_VALUATION_PRESTIGE_LOCAL_WEIGHT: float = 0.35
    STAR_VALUATION_PRESTIGE_ABSOLUTE_WEIGHT: float = 0.65
    STAR_VALUATION_PRESTIGE_COMPOUND_TOP_TRAITS: int = 3
    STAR_VALUATION_PRESTIGE_COMPOUND_TRIGGER: float = 0.53
    STAR_VALUATION_PRESTIGE_COMPOUND_CLEAR: float = 0.63
    STAR_VALUATION_PRESTIGE_COMPOUND_VERY_RARE: float = 0.73
    STAR_VALUATION_PRESTIGE_COMPOUND_ELITE: float = 0.83
    STAR_VALUATION_PRESTIGE_COMPOUND_MYTHIC: float = 0.92
    STAR_VALUATION_PRESTIGE_COMPOUND_CLEAR_BONUS: float = 0.16
    STAR_VALUATION_PRESTIGE_COMPOUND_VERY_RARE_BONUS: float = 0.42
    STAR_VALUATION_PRESTIGE_COMPOUND_ELITE_BONUS: float = 1.05
    STAR_VALUATION_PRESTIGE_COMPOUND_MYTHIC_BONUS: float = 1.95
    STAR_VALUATION_PRESTIGE_COMPOUND_APEX_BONUS: float = 3.8
    STAR_VALUATION_PRESTIGE_COMPOUND_ELITE_DEPTH_THRESHOLD: float = 0.85
    STAR_VALUATION_PRESTIGE_COMPOUND_APEX_DEPTH_THRESHOLD: float = 0.93
    STAR_VALUATION_PRESTIGE_COMPOUND_ELITE_DEPTH_BONUS: float = 0.10
    STAR_VALUATION_PRESTIGE_COMPOUND_APEX_DEPTH_BONUS: float = 0.18
    STAR_VALUATION_PRESTIGE_COMPOUND_CAP: float = 4.0
    STAR_VALUATION_CLASS_PREMIUMS_JSON: str = (
        '{"MIRA":0.95,"MIRA_SR":0.9,"RRAB":0.82,"RRC":0.74,"DSCT_SXPHE":0.68,'
        '"EA":0.62,"EB":0.58,"EW":0.56,"ROT":0.52,"SOLAR_LIKE":0.5,"UNKNOWN":0.4}'
    )
    STAR_VALUATION_EVOLSTAGE_PREMIUMS_JSON: str = (
        '{"0":0.08,"1":0.10,"2":0.16,"3":0.22,"4":0.30,"5":0.45,"6":0.62,"7":0.78}'
    )
    STAR_VALUATION_PRESTIGE_ABSOLUTE_LEVELS_JSON: str = '[0.14,0.3,0.52,0.76,1.0]'
    STAR_VALUATION_PRESTIGE_BREAKPOINTS_JSON: str = (
        '{"luminosity":[35,120,420,1600,6000],'
        '"mass":[1.3,2.2,3.8,6.8,11.5],'
        '"radius":[1.8,5.0,14.0,40.0,110.0],'
        '"age":[4.0,7.0,9.5,11.7,13.1],'
        '"lifetime_energy":[1.3,1.9,2.6,3.5,4.4]}'
    )
    STAR_VALUATION_PRESTIGE_WEIGHTS_JSON: str = (
        '{"luminosity":0.31,"mass":0.18,"radius":0.25,"age":0.08,"lifetime_energy":0.31,"evolstage":0.07}'
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

    @property
    def star_valuation_evolstage_premiums(self) -> dict[str, float]:
        try:
            parsed = json.loads(self.STAR_VALUATION_EVOLSTAGE_PREMIUMS_JSON)
        except json.JSONDecodeError:
            return {}
        return {
            str(key): float(value)
            for key, value in parsed.items()
        }

    @property
    def star_valuation_prestige_absolute_levels(self) -> list[float]:
        try:
            parsed = json.loads(self.STAR_VALUATION_PRESTIGE_ABSOLUTE_LEVELS_JSON)
        except json.JSONDecodeError:
            return [0.14, 0.3, 0.52, 0.76, 1.0]
        if not isinstance(parsed, list):
            return [0.14, 0.3, 0.52, 0.76, 1.0]
        return [float(value) for value in parsed]

    @property
    def star_valuation_prestige_breakpoints(self) -> dict[str, list[float]]:
        try:
            parsed = json.loads(self.STAR_VALUATION_PRESTIGE_BREAKPOINTS_JSON)
        except json.JSONDecodeError:
            return {}
        if not isinstance(parsed, dict):
            return {}
        normalized: dict[str, list[float]] = {}
        for key, value in parsed.items():
            if isinstance(value, list):
                normalized[str(key)] = [float(item) for item in value]
        return normalized

    @property
    def star_valuation_prestige_weights(self) -> dict[str, float]:
        try:
            parsed = json.loads(self.STAR_VALUATION_PRESTIGE_WEIGHTS_JSON)
        except json.JSONDecodeError:
            return {}
        if not isinstance(parsed, dict):
            return {}
        return {
            str(key): float(value)
            for key, value in parsed.items()
        }

settings = Settings()
