from __future__ import annotations

import bisect
import datetime as dt
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.external_market_input import ExternalMarketInput
from app.models.star import Star
from app.models.star_valuation_history import StarValuationHistory


REQUIRED_VALUATION_METRICS = (
    "phot_g_mean_mag",
    "parallax",
    "lum_flame",
    "teff_gspphot",
    "mh_gspphot",
    "non_single_star",
    "phot_variable_flag",
    "best_class_name",
    "radius_flame",
    "age_flame",
)


def money_decimal(value: float | int | Decimal | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def has_required_valuation_metrics(star: Star) -> bool:
    return not missing_valuation_metrics(star)


def missing_valuation_metrics(star: Star) -> list[str]:
    missing = []
    for field_name in REQUIRED_VALUATION_METRICS:
        value = getattr(star, field_name, None)
        if value in (None, ""):
            missing.append(field_name)
    return missing


def valuation_display_name(star: Star) -> str:
    return star.common_name or star.display_name or star.scientific_name


def variable_flag_is_positive(value: Optional[str]) -> bool:
    normalized = (value or "").strip().lower()
    return normalized not in {"", "not_available", "constant", "not variable"}


def class_score(best_class_name: Optional[str]) -> float:
    normalized = (best_class_name or "").strip().upper()
    if not normalized:
        return settings.star_valuation_class_premiums.get("UNKNOWN", 0.4)
    if normalized in settings.star_valuation_class_premiums:
        return settings.star_valuation_class_premiums[normalized]
    for key, value in settings.star_valuation_class_premiums.items():
        if key != "UNKNOWN" and normalized.startswith(key):
            return value
    return settings.star_valuation_class_premiums.get("UNKNOWN", 0.4)


def percentile_rank(ordered_values: list[float], value: float, inverse: bool = False) -> float:
    if not ordered_values:
        return 0.5
    rank = bisect.bisect_right(ordered_values, value)
    percentile = rank / len(ordered_values)
    percentile = max(0.0, min(1.0, percentile))
    return 1.0 - percentile if inverse else percentile


@dataclass
class StarScoreBundle:
    baseline_score: float
    energy_score: float
    metals_score: float
    baseline_multiplier: float


def _metric_series(stars: Iterable[Star], field_name: str) -> list[float]:
    values = []
    for star in stars:
        raw_value = getattr(star, field_name, None)
        if raw_value is None:
            continue
        try:
            values.append(float(raw_value))
        except (TypeError, ValueError):
            continue
    return sorted(values)


def build_star_score_bundles(stars: list[Star]) -> dict[int, StarScoreBundle]:
    eligible_stars = [star for star in stars if has_required_valuation_metrics(star)]
    phot_series = _metric_series(eligible_stars, "phot_g_mean_mag")
    parallax_series = _metric_series(eligible_stars, "parallax")
    radius_series = _metric_series(eligible_stars, "radius_flame")
    age_series = _metric_series(eligible_stars, "age_flame")
    lum_series = _metric_series(eligible_stars, "lum_flame")
    temp_series = _metric_series(eligible_stars, "teff_gspphot")
    metal_series = _metric_series(eligible_stars, "mh_gspphot")

    baseline_weight_total = (
        settings.STAR_VALUATION_BRIGHTNESS_WEIGHT
        + settings.STAR_VALUATION_PARALLAX_WEIGHT
        + settings.STAR_VALUATION_NON_SINGLE_WEIGHT
        + settings.STAR_VALUATION_VARIABLE_WEIGHT
        + settings.STAR_VALUATION_CLASS_WEIGHT
        + settings.STAR_VALUATION_RADIUS_WEIGHT
        + settings.STAR_VALUATION_AGE_WEIGHT
    )
    energy_weight_total = settings.STAR_VALUATION_LUMINOSITY_WEIGHT + settings.STAR_VALUATION_TEMPERATURE_WEIGHT
    metals_weight_total = settings.STAR_VALUATION_METALLICITY_WEIGHT

    bundles: dict[int, StarScoreBundle] = {}
    for star in eligible_stars:
        brightness_score = percentile_rank(phot_series, float(star.phot_g_mean_mag), inverse=True)
        parallax_score = percentile_rank(parallax_series, float(star.parallax))
        non_single_score = 1.0 if star.non_single_star else 0.0
        variable_score = 1.0 if variable_flag_is_positive(star.phot_variable_flag) else 0.0
        classification_score = class_score(star.best_class_name)
        radius_score = percentile_rank(radius_series, float(star.radius_flame))
        age_score = percentile_rank(age_series, float(star.age_flame))
        lum_score = percentile_rank(lum_series, float(star.lum_flame))
        temp_score = percentile_rank(temp_series, float(star.teff_gspphot))
        metals_score = percentile_rank(metal_series, float(star.mh_gspphot))

        baseline_score = (
            brightness_score * settings.STAR_VALUATION_BRIGHTNESS_WEIGHT
            + parallax_score * settings.STAR_VALUATION_PARALLAX_WEIGHT
            + non_single_score * settings.STAR_VALUATION_NON_SINGLE_WEIGHT
            + variable_score * settings.STAR_VALUATION_VARIABLE_WEIGHT
            + classification_score * settings.STAR_VALUATION_CLASS_WEIGHT
            + radius_score * settings.STAR_VALUATION_RADIUS_WEIGHT
            + age_score * settings.STAR_VALUATION_AGE_WEIGHT
        ) / baseline_weight_total

        energy_score = (
            lum_score * settings.STAR_VALUATION_LUMINOSITY_WEIGHT
            + temp_score * settings.STAR_VALUATION_TEMPERATURE_WEIGHT
        ) / energy_weight_total
        combined_metals_score = (metals_score * settings.STAR_VALUATION_METALLICITY_WEIGHT) / metals_weight_total

        baseline_multiplier = settings.STAR_VALUATION_BASELINE_MIN_MULTIPLIER + (
            settings.STAR_VALUATION_BASELINE_MAX_MULTIPLIER - settings.STAR_VALUATION_BASELINE_MIN_MULTIPLIER
        ) * baseline_score

        bundles[star.id] = StarScoreBundle(
            baseline_score=baseline_score,
            energy_score=energy_score,
            metals_score=combined_metals_score,
            baseline_multiplier=baseline_multiplier,
        )
    return bundles


def compute_model_value(
    first_purchase_price: Decimal,
    score_bundle: StarScoreBundle,
    energy_change_ratio: Optional[float],
    metals_change_ratio: Optional[float],
) -> Decimal:
    baseline_value = first_purchase_price * Decimal(str(score_bundle.baseline_multiplier))
    energy_change = energy_change_ratio or 0.0
    metals_change = metals_change_ratio or 0.0
    market_multiplier = Decimal(
        str(
            1.0
            + energy_change * settings.STAR_VALUATION_ENERGY_IMPACT_MULTIPLIER * score_bundle.energy_score
            + metals_change * settings.STAR_VALUATION_METALS_IMPACT_MULTIPLIER * score_bundle.metals_score
        )
    )
    value_floor = first_purchase_price * Decimal(str(settings.STAR_VALUATION_MIN_VALUE_FLOOR_MULTIPLIER))
    return max(value_floor, (baseline_value * market_multiplier)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def sync_external_market_inputs(
    db: AsyncSession,
    snapshots: list,
) -> list[ExternalMarketInput]:
    persisted: list[ExternalMarketInput] = []
    for snapshot in snapshots:
        result = await db.execute(
            select(ExternalMarketInput).where(
                ExternalMarketInput.provider == snapshot.provider,
                ExternalMarketInput.market_date == snapshot.market_date,
            )
        )
        record = result.scalar_one_or_none()
        if record is None:
            record = ExternalMarketInput(
                provider=snapshot.provider,
                market_date=snapshot.market_date,
                energy_symbol=snapshot.energy_symbol,
                metals_symbol=snapshot.metals_symbol,
            )
            db.add(record)
        record.energy_price = snapshot.energy_price
        record.metals_price = snapshot.metals_price
        record.energy_change_ratio = snapshot.energy_change_ratio
        record.metals_change_ratio = snapshot.metals_change_ratio
        record.raw_payload = snapshot.raw_payload
        persisted.append(record)
    await db.flush()
    return persisted


async def recalculate_model_values(
    db: AsyncSession,
    valuation_dates: Optional[list[dt.date]] = None,
) -> dict[str, int]:
    stars_result = await db.execute(select(Star).order_by(Star.id.asc()))
    stars = list(stars_result.scalars().all())
    bundles = build_star_score_bundles(stars)

    inputs_query = (
        select(ExternalMarketInput)
        .where(ExternalMarketInput.provider == settings.STAR_VALUATION_PROVIDER)
        .order_by(ExternalMarketInput.market_date.asc())
    )
    if valuation_dates:
        inputs_query = inputs_query.where(ExternalMarketInput.market_date.in_(valuation_dates))
    inputs_result = await db.execute(inputs_query)
    market_inputs = list(inputs_result.scalars().all())
    history_dates = [item.market_date for item in market_inputs]

    existing_history_by_key: dict[tuple[int, dt.date], StarValuationHistory] = {}
    if history_dates:
        existing_history_result = await db.execute(
            select(StarValuationHistory).where(
                StarValuationHistory.valuation_date.in_(history_dates)
            )
        )
        existing_history_by_key = {
            (history.star_id, history.valuation_date): history
            for history in existing_history_result.scalars().all()
        }

    created_history_rows = 0
    updated_star_rows = 0
    first_purchase_price = money_decimal(settings.STAR_ISSUE_PRICE)
    for star in stars:
        star.issue_price = first_purchase_price
        missing = missing_valuation_metrics(star)
        star.valuation_missing_metrics = missing or None
        star.valuation_eligible = not missing
        if star.id not in bundles:
            continue

        for market_input in market_inputs:
            model_value = compute_model_value(
                first_purchase_price=first_purchase_price,
                score_bundle=bundles[star.id],
                energy_change_ratio=market_input.energy_change_ratio,
                metals_change_ratio=market_input.metals_change_ratio,
            )
            history_key = (star.id, market_input.market_date)
            history = existing_history_by_key.get(history_key)
            if history is None:
                history = StarValuationHistory(
                    star_id=star.id,
                    valuation_date=market_input.market_date,
                )
                db.add(history)
                existing_history_by_key[history_key] = history
                created_history_rows += 1
            history.issue_price = first_purchase_price
            history.model_value = model_value
            history.energy_price = market_input.energy_price
            history.metals_price = market_input.metals_price
            history.energy_change_ratio = market_input.energy_change_ratio
            history.metals_change_ratio = market_input.metals_change_ratio

        latest_input = market_inputs[-1] if market_inputs else None
        latest_model_value = first_purchase_price
        if latest_input is not None:
            latest_model_value = compute_model_value(
                first_purchase_price=first_purchase_price,
                score_bundle=bundles[star.id],
                energy_change_ratio=latest_input.energy_change_ratio,
                metals_change_ratio=latest_input.metals_change_ratio,
            )
            star.model_value_last_calculated_at = dt.datetime.combine(
                latest_input.market_date,
                dt.time(12, 0, tzinfo=dt.timezone.utc),
            )
        star.model_value = latest_model_value
        updated_star_rows += 1

    await db.flush()
    return {
        "stars_seen": len(stars),
        "eligible_stars": len(bundles),
        "history_rows_created": created_history_rows,
        "stars_updated": updated_star_rows,
    }
