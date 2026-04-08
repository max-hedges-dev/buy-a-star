from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from app.core.config import settings
from app.models.star import Star
from app.services.certificate_options import get_certificate_option, list_certificate_options

EURO_COUNTRIES = {
    "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR",
    "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
}
EUROPE_BAND_COUNTRIES = EURO_COUNTRIES | {
    "AL", "BA", "BG", "CH", "CZ", "DK", "HU", "IS", "LI", "MD",
    "ME", "MK", "NO", "PL", "RO", "RS", "SE",
}
COUNTRY_TO_CURRENCY = {
    "AE": "aed",
    "AU": "aud",
    "BG": "bgn",
    "BR": "brl",
    "CA": "cad",
    "CH": "chf",
    "CN": "cny",
    "CZ": "czk",
    "DK": "dkk",
    "GB": "gbp",
    "HK": "hkd",
    "HU": "huf",
    "IL": "ils",
    "IN": "inr",
    "JP": "jpy",
    "MX": "mxn",
    "NO": "nok",
    "NZ": "nzd",
    "PL": "pln",
    "RO": "ron",
    "SA": "sar",
    "SE": "sek",
    "SG": "sgd",
    "TR": "try",
    "US": "usd",
    "ZA": "zar",
}
FX_RATES_FROM_GBP = {
    "aed": Decimal("4.67"),
    "aud": Decimal("1.97"),
    "bgn": Decimal("2.27"),
    "brl": Decimal("7.34"),
    "cad": Decimal("1.74"),
    "chf": Decimal("1.14"),
    "cny": Decimal("9.24"),
    "czk": Decimal("29.35"),
    "dkk": Decimal("8.70"),
    "hkd": Decimal("10.02"),
    "huf": Decimal("462.00"),
    "ils": Decimal("4.62"),
    "inr": Decimal("106.80"),
    "jpy": Decimal("193.00"),
    "mxn": Decimal("24.55"),
    "nok": Decimal("13.70"),
    "nzd": Decimal("2.12"),
    "pln": Decimal("5.08"),
    "ron": Decimal("5.93"),
    "sar": Decimal("4.78"),
    "sek": Decimal("13.44"),
    "sgd": Decimal("1.72"),
    "try": Decimal("47.50"),
    "zar": Decimal("23.55"),
}
ZERO_DECIMAL_CURRENCIES = {"jpy"}
SUPPORTED_COUNTRIES = sorted(set(COUNTRY_TO_CURRENCY.keys()) | EURO_COUNTRIES)
DEFAULT_COUNTRY_CODE = settings.STRIPE_DEFAULT_COUNTRY_CODE.upper()
IDENTITY_PRICE_CURRENCIES = {"gbp", "usd", "eur"}


@dataclass(frozen=True)
class MoneyAmount:
    currency: str
    amount_minor_units: int

    @property
    def amount_major(self) -> Decimal:
        factor = Decimal("1") if self.currency in ZERO_DECIMAL_CURRENCIES else Decimal("100")
        return Decimal(self.amount_minor_units) / factor


@dataclass(frozen=True)
class PricingQuote:
    country_code: str
    currency: str
    named_star_price: MoneyAmount
    unnamed_star_price: MoneyAmount
    certificate_prices: dict[str, MoneyAmount]
    shipping_price: MoneyAmount


def normalize_country_code(country_code: str | None) -> str:
    code = (country_code or DEFAULT_COUNTRY_CODE).strip().upper()
    if not code or len(code) != 2:
        return DEFAULT_COUNTRY_CODE
    return code


def currency_for_country(country_code: str) -> str:
    code = normalize_country_code(country_code)
    if code in EURO_COUNTRIES:
        return "eur"
    return COUNTRY_TO_CURRENCY.get(code, "usd")


def _minor_unit_factor(currency: str) -> Decimal:
    return Decimal("1") if currency in ZERO_DECIMAL_CURRENCIES else Decimal("100")


def major_amount_from_minor_units(amount_minor_units: int, currency: str) -> Decimal:
    return Decimal(amount_minor_units) / _minor_unit_factor(currency.lower())


def convert_from_gbp(base_minor_units: int, currency: str) -> MoneyAmount:
    normalized_currency = currency.lower()
    if normalized_currency in IDENTITY_PRICE_CURRENCIES:
        factor = _minor_unit_factor(normalized_currency)
        amount_major = Decimal(base_minor_units) / Decimal("100")
        return MoneyAmount(
            currency=normalized_currency,
            amount_minor_units=int((amount_major * factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
        )

    rate = FX_RATES_FROM_GBP.get(normalized_currency)
    if rate is None:
        normalized_currency = "usd"
        factor = _minor_unit_factor(normalized_currency)
        amount_major = Decimal(base_minor_units) / Decimal("100")
        return MoneyAmount(
            currency=normalized_currency,
            amount_minor_units=int((amount_major * factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
        )

    gbp_major = Decimal(base_minor_units) / Decimal("100")
    converted_major = gbp_major * rate
    factor = _minor_unit_factor(normalized_currency)
    return MoneyAmount(
        currency=normalized_currency,
        amount_minor_units=int((converted_major * factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
    )


def is_named_star(star: Star) -> bool:
    return bool(star.common_name and star.common_name.strip())


def shipping_band_price_minor_units(country_code: str) -> int:
    code = normalize_country_code(country_code)
    if code == "GB":
        return settings.STRIPE_UK_SHIPPING_RATE_GBP
    if code == "US":
        return settings.STRIPE_US_SHIPPING_RATE_GBP
    if code in EUROPE_BAND_COUNTRIES:
        return settings.STRIPE_EUROPE_SHIPPING_RATE_GBP
    return settings.STRIPE_REST_OF_WORLD_SHIPPING_RATE_GBP


def shipping_display_name(country_code: str) -> str:
    code = normalize_country_code(country_code)
    if code == "GB":
        return "UK Shipping"
    if code == "US":
        return "US Shipping"
    if code in EUROPE_BAND_COUNTRIES:
        return "Europe Shipping"
    return "International Shipping"


def pricing_quote_for_country(country_code: str) -> PricingQuote:
    normalized_country = normalize_country_code(country_code)
    currency = currency_for_country(normalized_country)
    certificate_prices = {
        option.code: convert_from_gbp(option.base_price_minor_units, currency)
        for option in list_certificate_options()
    }
    return PricingQuote(
        country_code=normalized_country,
        currency=currency,
        named_star_price=convert_from_gbp(settings.STRIPE_NAMED_STAR_PRICE_GBP, currency),
        unnamed_star_price=convert_from_gbp(settings.STRIPE_UNNAMED_STAR_PRICE_GBP, currency),
        certificate_prices=certificate_prices,
        shipping_price=convert_from_gbp(shipping_band_price_minor_units(normalized_country), currency),
    )


def star_price_for_country(star: Star, country_code: str) -> MoneyAmount:
    quote = pricing_quote_for_country(country_code)
    return quote.named_star_price if is_named_star(star) else quote.unnamed_star_price


def certificate_price_for_country(certificate_type: str, country_code: str) -> MoneyAmount:
    quote = pricing_quote_for_country(country_code)
    option = get_certificate_option(certificate_type)
    return quote.certificate_prices[option.code]
