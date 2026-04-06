from __future__ import annotations

import csv
import datetime as dt
import io
import math
import urllib.request
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from app.core.config import settings


@dataclass
class MarketInputPoint:
    market_date: dt.date
    value: Decimal


@dataclass
class MarketInputSnapshot:
    provider: str
    market_date: dt.date
    energy_symbol: str
    metals_symbol: str
    energy_price: Decimal
    metals_price: Decimal
    energy_change_ratio: Optional[float]
    metals_change_ratio: Optional[float]
    raw_payload: dict


def _decimal(value: str) -> Decimal:
    return Decimal(str(value))


def _parse_stooq_history(symbol: str) -> list[MarketInputPoint]:
    url = f"https://stooq.com/q/d/l/?s={symbol}&i=d"
    with urllib.request.urlopen(url, timeout=30) as response:
        payload = response.read().decode("utf-8", "ignore")
    reader = csv.DictReader(io.StringIO(payload))
    points: list[MarketInputPoint] = []
    for row in reader:
        date_raw = row.get("Date")
        close_raw = row.get("Close")
        if not date_raw or not close_raw or close_raw in {"", "0", "-"}:
            continue
        try:
            points.append(
                MarketInputPoint(
                    market_date=dt.date.fromisoformat(date_raw),
                    value=_decimal(close_raw),
                )
            )
        except Exception:
            continue
    points.sort(key=lambda item: item.market_date)
    return points


def _parse_fred_history(series_id: str) -> list[MarketInputPoint]:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    with urllib.request.urlopen(url, timeout=30) as response:
        payload = response.read().decode("utf-8", "ignore")
    reader = csv.DictReader(io.StringIO(payload))
    points: list[MarketInputPoint] = []
    for row in reader:
        date_raw = row.get("observation_date")
        value_raw = row.get(series_id)
        if not date_raw or not value_raw or value_raw in {"", ".", "0", "-"}:
            continue
        try:
            points.append(
                MarketInputPoint(
                    market_date=dt.date.fromisoformat(date_raw),
                    value=_decimal(value_raw),
                )
            )
        except Exception:
            continue
    points.sort(key=lambda item: item.market_date)
    return points


def _metals_component_config() -> list[tuple[str, str, float]]:
    return [
        ("iron_ore", settings.STAR_VALUATION_METALS_IRON_ORE_SYMBOL, settings.STAR_VALUATION_METALS_IRON_ORE_WEIGHT),
        ("copper", settings.STAR_VALUATION_METALS_COPPER_SYMBOL, settings.STAR_VALUATION_METALS_COPPER_WEIGHT),
        ("silver", settings.STAR_VALUATION_METALS_SILVER_SYMBOL, settings.STAR_VALUATION_METALS_SILVER_WEIGHT),
        ("gold", settings.STAR_VALUATION_METALS_GOLD_SYMBOL, settings.STAR_VALUATION_METALS_GOLD_WEIGHT),
    ]


def fetch_market_history(provider: Optional[str] = None) -> dict[str, list[MarketInputPoint]]:
    selected_provider = (provider or settings.STAR_VALUATION_PROVIDER).lower()
    if selected_provider == "stooq":
        return {
            "provider": selected_provider,
            "energy_symbol": settings.STAR_VALUATION_ENERGY_SYMBOL,
            "metals_symbol": settings.STAR_VALUATION_METALS_SYMBOL,
            "energy": _parse_stooq_history(settings.STAR_VALUATION_ENERGY_SYMBOL),
            "metals": _parse_stooq_history(settings.STAR_VALUATION_METALS_SYMBOL),
        }
    if selected_provider == "fred":
        return {
            "provider": selected_provider,
            "energy_symbol": settings.STAR_VALUATION_ENERGY_SYMBOL,
            "metals_symbol": settings.STAR_VALUATION_METALS_SYMBOL,
            "energy": _parse_fred_history(settings.STAR_VALUATION_ENERGY_SYMBOL),
            "metals_components": {
                component_name: {
                    "symbol": symbol,
                    "weight": weight,
                    "history": _parse_fred_history(symbol),
                }
                for component_name, symbol, weight in _metals_component_config()
            },
        }
    raise ValueError(f"Unsupported valuation provider: {selected_provider}")


def combine_market_history(provider: Optional[str] = None, max_points: Optional[int] = None) -> list[MarketInputSnapshot]:
    raw = fetch_market_history(provider)
    energy_by_date = {point.market_date: point for point in raw["energy"]}
    metals_components = raw.get("metals_components") or {}
    metals_by_component_and_date = {
        component_name: {point.market_date: point for point in component["history"]}
        for component_name, component in metals_components.items()
    }
    component_weights = {
        component_name: float(component["weight"])
        for component_name, component in metals_components.items()
    }
    dates = set(energy_by_date)
    for component_points in metals_by_component_and_date.values():
        dates.update(component_points.keys())
    ordered_dates = sorted(dates)

    snapshots: list[MarketInputSnapshot] = []
    previous_energy: Optional[Decimal] = None
    current_energy: Optional[Decimal] = None
    current_metals_by_component: dict[str, Decimal] = {}
    previous_metals_by_component: dict[str, Decimal] = {}
    recent_metals_basket_log_returns: list[float] = []
    metals_basket_index = Decimal("100")

    for market_date in ordered_dates:
        energy_point = energy_by_date.get(market_date)
        if energy_point is not None:
            current_energy = energy_point.value
        for component_name, component_points in metals_by_component_and_date.items():
            component_point = component_points.get(market_date)
            if component_point is not None:
                current_metals_by_component[component_name] = component_point.value

        if current_energy is None:
            continue
        if not metals_by_component_and_date:
            continue
        if any(component_name not in current_metals_by_component for component_name in metals_by_component_and_date):
            continue

        energy_change_ratio = (
            float((current_energy - previous_energy) / previous_energy)
            if previous_energy not in (None, Decimal("0"))
            else None
        )

        basket_log_return = 0.0
        for component_name, current_value in current_metals_by_component.items():
            previous_value = previous_metals_by_component.get(component_name)
            component_log_return = 0.0
            if previous_value not in (None, Decimal("0")) and current_value > 0:
                component_log_return = math.log(float(current_value / previous_value))
            basket_log_return += component_weights.get(component_name, 0.0) * component_log_return

        recent_metals_basket_log_returns.append(basket_log_return)
        smoothing_window = max(1, int(settings.STAR_VALUATION_METALS_SMOOTHING_DAYS))
        smoothed_returns = recent_metals_basket_log_returns[-smoothing_window:]
        smoothed_metals_log_return = sum(smoothed_returns) / len(smoothed_returns)
        metals_change_ratio = None
        if previous_metals_by_component:
            metals_change_ratio = math.exp(smoothed_metals_log_return) - 1.0
            metals_basket_index = metals_basket_index * Decimal(str(math.exp(smoothed_metals_log_return)))

        snapshots.append(
            MarketInputSnapshot(
                provider=str(raw["provider"]),
                market_date=market_date,
                energy_symbol=str(raw["energy_symbol"]),
                metals_symbol=str(raw["metals_symbol"]),
                energy_price=current_energy,
                metals_price=metals_basket_index.quantize(Decimal("0.000001")),
                energy_change_ratio=energy_change_ratio,
                metals_change_ratio=metals_change_ratio,
                raw_payload={
                    "energy": {"symbol": raw["energy_symbol"], "close": str(current_energy)},
                    "metals": {
                        "symbol": raw["metals_symbol"],
                        "basket_index": str(metals_basket_index.quantize(Decimal("0.000001"))),
                        "smoothing_days": smoothing_window,
                        "smoothed_log_return": smoothed_metals_log_return,
                        "components": {
                            component_name: {
                                "symbol": metals_components[component_name]["symbol"],
                                "weight": component_weights[component_name],
                                "close": str(current_metals_by_component[component_name]),
                            }
                            for component_name in current_metals_by_component
                        },
                    },
                },
            )
        )
        previous_energy = current_energy
        previous_metals_by_component = dict(current_metals_by_component)
    if max_points is not None:
        return snapshots[-max_points:]
    return snapshots


def build_daily_market_snapshot(
    provider: Optional[str] = None,
    target_date: Optional[dt.date] = None,
) -> MarketInputSnapshot:
    effective_date = target_date or dt.date.today()
    snapshots = combine_market_history(provider=provider)
    if not snapshots:
        raise ValueError("No market snapshots are available.")

    latest = snapshots[-1]
    if latest.market_date == effective_date:
        return latest

    return MarketInputSnapshot(
        provider=latest.provider,
        market_date=effective_date,
        energy_symbol=latest.energy_symbol,
        metals_symbol=latest.metals_symbol,
        energy_price=latest.energy_price,
        metals_price=latest.metals_price,
        energy_change_ratio=0.0,
        metals_change_ratio=0.0,
        raw_payload={
            **latest.raw_payload,
            "forward_filled_from": str(latest.market_date),
        },
    )
