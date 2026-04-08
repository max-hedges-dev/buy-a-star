from __future__ import annotations

import asyncio
from dataclasses import dataclass

import stripe
from fastapi import HTTPException, status

from app.core.config import settings
from app.services.certificate_options import list_certificate_options


UK_SHIPPING_RATE_CATALOG_KEY = "uk_shipping_standard"

stripe.api_key = settings.STRIPE_SECRET_KEY or None


@dataclass(frozen=True)
class StripeCheckoutCatalog:
    certificate_price_ids: dict[str, str]
    shipping_rate_id: str | None


_catalog_cache: StripeCheckoutCatalog | None = None
_catalog_lock = asyncio.Lock()


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


def _catalog_missing_error(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"{message} Run backend/scripts/sync_stripe_catalog.py to create the Stripe sandbox catalog.",
    )


async def _run_stripe_call(func, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)


async def get_checkout_catalog() -> StripeCheckoutCatalog:
    global _catalog_cache

    if _catalog_cache is not None:
        return _catalog_cache

    async with _catalog_lock:
        if _catalog_cache is not None:
            return _catalog_cache

        prices_response = await _run_stripe_call(stripe.Price.list, active=True, limit=100)
        prices = _stripe_value(prices_response, "data", [])

        certificate_price_ids: dict[str, str] = {}
        for option in list_certificate_options():
            price_id = next(
                (
                    _stripe_value(price, "id")
                    for price in prices
                    if _stripe_value(price, "active")
                    and _stripe_value(price, "lookup_key") == option.price_lookup_key
                    and _stripe_value(price, "unit_amount") == option.price_minor_units
                ),
                None,
            )
            if not price_id:
                raise _catalog_missing_error(f"Missing Stripe price for {option.label}.")
            certificate_price_ids[option.code] = price_id

        shipping_rate_id = None
        shipping_rates_response = await _run_stripe_call(stripe.ShippingRate.list, active=True, limit=100)
        shipping_rates = _stripe_value(shipping_rates_response, "data", [])
        for shipping_rate in shipping_rates:
            metadata = _stripe_value(shipping_rate, "metadata", {}) or {}
            fixed_amount = _stripe_value(shipping_rate, "fixed_amount", {}) or {}
            if (
                _stripe_value(metadata, "catalog_key") == UK_SHIPPING_RATE_CATALOG_KEY
                and _stripe_value(fixed_amount, "amount") == settings.STRIPE_UK_SHIPPING_RATE_GBP
                and _stripe_value(fixed_amount, "currency") == settings.STRIPE_CURRENCY
            ):
                shipping_rate_id = _stripe_value(shipping_rate, "id")
                break

        if not shipping_rate_id:
            raise _catalog_missing_error("Missing Stripe UK shipping rate.")

        _catalog_cache = StripeCheckoutCatalog(
            certificate_price_ids=certificate_price_ids,
            shipping_rate_id=shipping_rate_id,
        )
        return _catalog_cache


def reset_checkout_catalog_cache() -> None:
    global _catalog_cache
    _catalog_cache = None
