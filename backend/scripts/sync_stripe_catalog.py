from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sys

import stripe

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.services.certificate_options import list_certificate_options
from app.services.stripe_catalog import UK_SHIPPING_RATE_CATALOG_KEY, reset_checkout_catalog_cache


@dataclass
class CatalogResult:
    kind: str
    label: str
    stripe_id: str
    created: bool


def _stripe_value(value, key: str, default=None):
    if value is None:
        return default
    if isinstance(value, dict):
        return value.get(key, default)
    try:
        return value.get(key, default)
    except Exception:
        pass
    try:
        return value[key]
    except Exception:
        return default


def _require_stripe_key() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise RuntimeError("STRIPE_SECRET_KEY is not configured.")

    stripe.api_key = settings.STRIPE_SECRET_KEY


def _find_product(catalog_key: str):
    products = _stripe_value(stripe.Product.list(active=True, limit=100), "data", [])
    for product in products:
        metadata = _stripe_value(product, "metadata", {}) or {}
        if _stripe_value(metadata, "catalog_key") == catalog_key:
            return product
    return None


def _ensure_product(*, catalog_key: str, name: str, description: str, shippable: bool):
    existing = _find_product(catalog_key)
    if existing:
        needs_update = (
            _stripe_value(existing, "name") != name
            or _stripe_value(existing, "description") != description
            or _stripe_value(existing, "shippable") != shippable
        )
        if needs_update:
            existing = stripe.Product.modify(
                _stripe_value(existing, "id"),
                name=name,
                description=description,
                shippable=shippable,
                metadata={"catalog_key": catalog_key},
            )
        return existing, False

    created = stripe.Product.create(
        name=name,
        description=description,
        shippable=shippable,
        metadata={"catalog_key": catalog_key},
    )
    return created, True


def _find_price(lookup_key: str, unit_amount: int):
    prices = _stripe_value(stripe.Price.list(active=True, limit=100), "data", [])
    for price in prices:
        if (
            _stripe_value(price, "lookup_key") == lookup_key
            and _stripe_value(price, "unit_amount") == unit_amount
            and _stripe_value(price, "currency") == settings.STRIPE_CURRENCY
        ):
            return price
    return None


def _find_price_by_lookup_key(lookup_key: str):
    prices = _stripe_value(stripe.Price.list(active=True, limit=100), "data", [])
    for price in prices:
        if _stripe_value(price, "lookup_key") == lookup_key:
            return price
    return None


def _ensure_price(*, lookup_key: str, product_id: str, unit_amount: int, nickname: str):
    existing = _find_price(lookup_key, unit_amount)
    if existing:
        return existing, False

    created = stripe.Price.create(
        currency=settings.STRIPE_CURRENCY,
        unit_amount=unit_amount,
        product=product_id,
        lookup_key=lookup_key,
        transfer_lookup_key=True,
        nickname=nickname,
    )

    current_lookup_holder = _find_price_by_lookup_key(lookup_key)
    if current_lookup_holder and _stripe_value(current_lookup_holder, "id") != _stripe_value(created, "id"):
        stripe.Price.modify(
            _stripe_value(current_lookup_holder, "id"),
            active=False,
        )
    return created, True


def _find_shipping_rate():
    shipping_rates = _stripe_value(stripe.ShippingRate.list(active=True, limit=100), "data", [])
    for shipping_rate in shipping_rates:
        metadata = _stripe_value(shipping_rate, "metadata", {}) or {}
        fixed_amount = _stripe_value(shipping_rate, "fixed_amount", {}) or {}
        if (
            _stripe_value(metadata, "catalog_key") == UK_SHIPPING_RATE_CATALOG_KEY
            and _stripe_value(fixed_amount, "amount") == settings.STRIPE_UK_SHIPPING_RATE_GBP
            and _stripe_value(fixed_amount, "currency") == settings.STRIPE_CURRENCY
        ):
            return shipping_rate
    return None


def _ensure_shipping_rate():
    existing = _find_shipping_rate()
    if existing:
        return existing, False

    created = stripe.ShippingRate.create(
        display_name="UK Shipping",
        type="fixed_amount",
        fixed_amount={
            "amount": settings.STRIPE_UK_SHIPPING_RATE_GBP,
            "currency": settings.STRIPE_CURRENCY,
        },
        delivery_estimate={
            "minimum": {"unit": "business_day", "value": 2},
            "maximum": {"unit": "business_day", "value": 5},
        },
        metadata={"catalog_key": UK_SHIPPING_RATE_CATALOG_KEY},
    )
    return created, True


def main() -> None:
    _require_stripe_key()

    results: list[CatalogResult] = []

    for option in list_certificate_options():
        product, product_created = _ensure_product(
            catalog_key=option.product_catalog_key,
            name=option.label,
            description=option.description,
            shippable=option.shipping_required,
        )
        results.append(
            CatalogResult(
                kind="product",
                label=option.label,
                stripe_id=_stripe_value(product, "id"),
                created=product_created,
            )
        )

        price, price_created = _ensure_price(
            lookup_key=option.price_lookup_key,
            product_id=_stripe_value(product, "id"),
            unit_amount=option.base_price_minor_units,
            nickname=f"{option.label} ({settings.STRIPE_CURRENCY.upper()})",
        )
        results.append(
            CatalogResult(
                kind="price",
                label=option.label,
                stripe_id=_stripe_value(price, "id"),
                created=price_created,
            )
        )

    shipping_rate, shipping_created = _ensure_shipping_rate()
    results.append(
        CatalogResult(
            kind="shipping_rate",
            label="UK Shipping",
            stripe_id=_stripe_value(shipping_rate, "id"),
            created=shipping_created,
        )
    )

    reset_checkout_catalog_cache()

    print("Stripe catalog sync complete:")
    for result in results:
        action = "created" if result.created else "reused"
        print(f"- {result.kind}: {result.label} -> {result.stripe_id} ({action})")


if __name__ == "__main__":
    main()
