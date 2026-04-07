from __future__ import annotations

import bisect
import datetime as dt
import math
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Callable, Iterable, Optional

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


def _safe_float(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(numeric):
        return None
    return numeric


def _metric_series_from_getter(stars: Iterable[Star], getter: Callable[[Star], Optional[float]]) -> list[float]:
    values = []
    for star in stars:
        value = getter(star)
        if value is None:
            continue
        values.append(value)
    return sorted(values)


def _bp_rp_value(star: Star) -> Optional[float]:
    return _safe_float(star.bp_rp if star.bp_rp is not None else star.color_index)


def _proper_motion_value(star: Star) -> Optional[float]:
    pm = _safe_float(star.pm)
    if pm is not None:
        return pm
    pmra = _safe_float(star.pmra)
    pmdec = _safe_float(star.pmdec)
    if pmra is None or pmdec is None:
        return None
    return math.sqrt(pmra ** 2 + pmdec ** 2)


def _binary_probability_value(star: Star) -> Optional[float]:
    probability = _safe_float(star.classprob_dsc_combmod_binarystar)
    if probability is not None:
        return max(0.0, min(1.0, probability))
    if star.non_single_star is None:
        return None
    return 0.85 if star.non_single_star else 0.05


def _estimate_mass(star: Star) -> Optional[float]:
    mass = _safe_float(star.mass_flame)
    if mass is not None and mass > 0:
        return mass
    luminosity = _safe_float(star.lum_flame or star.luminosity)
    if luminosity is None or luminosity <= 0:
        return None
    return max(0.08, min(50.0, luminosity ** (1.0 / 3.5)))


def _lifetime_energy_output_raw(star: Star) -> Optional[float]:
    mass = _estimate_mass(star)
    luminosity = _safe_float(star.lum_flame or star.luminosity)
    age = _safe_float(star.age_flame)
    temperature = _safe_float(star.teff_gspphot)
    if luminosity is None:
        return None
    total_lifetime_gyr = max(age or 0.05, 0.05)
    if mass is not None and mass > 0:
        theoretical_total = max(0.01, 10.0 / (mass ** 2.5))
        total_lifetime_gyr = max(total_lifetime_gyr, theoretical_total)
    temperature_factor = 1.0
    if temperature is not None and temperature > 0:
        temperature_factor = max(0.6, min(1.8, (temperature / 5772.0) ** 0.15))
    mass_factor = max(0.6, min(2.0, (mass or 1.0) ** 0.2))
    proxy = max(luminosity, 0.0001) * total_lifetime_gyr * temperature_factor * mass_factor
    return math.log10(1.0 + proxy)


def _absolute_distance_percentile(series: list[float], value: float) -> float:
    if not series:
        return 0.0
    midpoint = series[len(series) // 2]
    distances = sorted(abs(item - midpoint) for item in series)
    return percentile_rank(distances, abs(value - midpoint))


def _tail_bonus_from_percentile(percentile: float) -> float:
    mild = settings.STAR_VALUATION_COOLNESS_MILD_THRESHOLD
    clear = settings.STAR_VALUATION_COOLNESS_CLEAR_THRESHOLD
    very_rare = settings.STAR_VALUATION_COOLNESS_VERY_RARE_THRESHOLD
    extreme = settings.STAR_VALUATION_COOLNESS_EXTREME_THRESHOLD
    points = [
        (0.0, 0.0),
        (mild, 0.0),
        (clear, settings.STAR_VALUATION_COOLNESS_MILD_BONUS),
        (very_rare, settings.STAR_VALUATION_COOLNESS_CLEAR_BONUS),
        (extreme, settings.STAR_VALUATION_COOLNESS_VERY_RARE_BONUS),
        (1.0, settings.STAR_VALUATION_COOLNESS_EXTREME_BONUS),
    ]
    bounded = max(0.0, min(1.0, percentile))
    for (left_p, left_bonus), (right_p, right_bonus) in zip(points, points[1:]):
        if bounded <= right_p:
            if right_p == left_p:
                return right_bonus
            progress = (bounded - left_p) / (right_p - left_p)
            return left_bonus + (right_bonus - left_bonus) * progress
    return settings.STAR_VALUATION_COOLNESS_EXTREME_BONUS


def _evolstage_collectible_score(star: Star) -> float:
    value = _safe_float(star.evolstage_flame)
    if value is None:
        return 0.0
    rounded = str(int(round(value)))
    return settings.star_valuation_evolstage_premiums.get(rounded, 0.0)


def _piecewise_interpolate(value: float, x_points: list[float], y_points: list[float]) -> float:
    if not x_points or not y_points or len(x_points) != len(y_points):
        return 0.0
    if value <= x_points[0]:
        if x_points[0] == 0:
            return y_points[0]
        progress = max(0.0, value) / x_points[0]
        return y_points[0] * progress
    for left_index in range(len(x_points) - 1):
        left_x = x_points[left_index]
        right_x = x_points[left_index + 1]
        left_y = y_points[left_index]
        right_y = y_points[left_index + 1]
        if value <= right_x:
            progress = (value - left_x) / max(right_x - left_x, 1e-9)
            return left_y + (right_y - left_y) * progress
    return y_points[-1]


def _prestige_absolute_score(trait_name: str, raw_value: Optional[float]) -> float:
    if raw_value is None:
        return 0.0
    breakpoints = settings.star_valuation_prestige_breakpoints.get(trait_name, [])
    levels = settings.star_valuation_prestige_absolute_levels
    if not breakpoints or not levels or len(breakpoints) != len(levels):
        return 0.0
    return max(0.0, min(1.0, _piecewise_interpolate(raw_value, breakpoints, levels)))


def _prestige_compound_bonus(compound_strength: float) -> float:
    x_points = [
        settings.STAR_VALUATION_PRESTIGE_COMPOUND_TRIGGER,
        settings.STAR_VALUATION_PRESTIGE_COMPOUND_CLEAR,
        settings.STAR_VALUATION_PRESTIGE_COMPOUND_VERY_RARE,
        settings.STAR_VALUATION_PRESTIGE_COMPOUND_ELITE,
        settings.STAR_VALUATION_PRESTIGE_COMPOUND_MYTHIC,
        1.0,
    ]
    y_points = [
        0.0,
        settings.STAR_VALUATION_PRESTIGE_COMPOUND_CLEAR_BONUS,
        settings.STAR_VALUATION_PRESTIGE_COMPOUND_VERY_RARE_BONUS,
        settings.STAR_VALUATION_PRESTIGE_COMPOUND_ELITE_BONUS,
        settings.STAR_VALUATION_PRESTIGE_COMPOUND_MYTHIC_BONUS,
        settings.STAR_VALUATION_PRESTIGE_COMPOUND_APEX_BONUS,
    ]
    if compound_strength <= x_points[0]:
        return 0.0
    return _piecewise_interpolate(compound_strength, x_points, y_points)


@dataclass
class StarScoreBundle:
    baseline_score: float
    energy_score: float
    metals_score: float
    baseline_multiplier: float
    coolness_premium: float
    cached_scores: dict[str, Any]


def build_star_score_bundles(stars: list[Star]) -> dict[int, StarScoreBundle]:
    eligible_stars = [star for star in stars if has_required_valuation_metrics(star)]
    phot_series = _metric_series_from_getter(eligible_stars, lambda star: _safe_float(star.phot_g_mean_mag))
    parallax_series = _metric_series_from_getter(eligible_stars, lambda star: _safe_float(star.parallax))
    radius_series = _metric_series_from_getter(eligible_stars, lambda star: _safe_float(star.radius_flame))
    age_series = _metric_series_from_getter(eligible_stars, lambda star: _safe_float(star.age_flame))
    lum_series = _metric_series_from_getter(eligible_stars, lambda star: _safe_float(star.lum_flame))
    temp_series = _metric_series_from_getter(eligible_stars, lambda star: _safe_float(star.teff_gspphot))
    metal_series = _metric_series_from_getter(eligible_stars, lambda star: _safe_float(star.mh_gspphot))

    bp_rp_series = _metric_series_from_getter(eligible_stars, _bp_rp_value)
    proper_motion_series = _metric_series_from_getter(eligible_stars, _proper_motion_value)
    radial_velocity_series = _metric_series_from_getter(eligible_stars, lambda star: _safe_float(star.radial_velocity))
    mass_series = _metric_series_from_getter(eligible_stars, _estimate_mass)
    lifetime_energy_series = _metric_series_from_getter(eligible_stars, _lifetime_energy_output_raw)
    binary_probability_series = _metric_series_from_getter(eligible_stars, _binary_probability_value)
    evolstage_series = _metric_series_from_getter(eligible_stars, _evolstage_collectible_score)

    baseline_weight_total = (
        settings.STAR_VALUATION_BRIGHTNESS_WEIGHT
        + settings.STAR_VALUATION_PARALLAX_WEIGHT
        + settings.STAR_VALUATION_NON_SINGLE_WEIGHT
        + settings.STAR_VALUATION_VARIABLE_WEIGHT
        + settings.STAR_VALUATION_CLASS_WEIGHT
        + settings.STAR_VALUATION_RADIUS_WEIGHT
        + settings.STAR_VALUATION_AGE_WEIGHT
    )
    energy_weight_total = (
        settings.STAR_VALUATION_LUMINOSITY_WEIGHT
        + settings.STAR_VALUATION_TEMPERATURE_WEIGHT
        + settings.STAR_VALUATION_LIFETIME_ENERGY_MARKET_WEIGHT
    )
    metals_weight_total = settings.STAR_VALUATION_METALLICITY_WEIGHT

    ordinary_coolness_fields = [
        ("bp_rp_outlier", _bp_rp_value, bp_rp_series, True, settings.STAR_VALUATION_COOLNESS_COLOR_WEIGHT),
        ("proper_motion_outlier", _proper_motion_value, proper_motion_series, True, settings.STAR_VALUATION_COOLNESS_PROPER_MOTION_WEIGHT),
        ("radial_velocity_outlier", lambda star: _safe_float(star.radial_velocity), radial_velocity_series, True, settings.STAR_VALUATION_COOLNESS_RADIAL_VELOCITY_WEIGHT),
        ("temperature_outlier", lambda star: _safe_float(star.teff_gspphot), temp_series, True, settings.STAR_VALUATION_COOLNESS_TEMPERATURE_WEIGHT),
    ]

    prestige_fields = [
        ("luminosity", "luminosity_outlier", lambda star: _safe_float(star.lum_flame), lum_series),
        ("mass", "mass_outlier", _estimate_mass, mass_series),
        ("radius", "radius_outlier", lambda star: _safe_float(star.radius_flame), radius_series),
        ("age", "age_outlier", lambda star: _safe_float(star.age_flame), age_series),
        ("lifetime_energy", "lifetime_energy_output_score", _lifetime_energy_output_raw, lifetime_energy_series),
        ("evolstage", "evolstage_collectible", _evolstage_collectible_score, evolstage_series),
    ]

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
        lifetime_energy_raw = _lifetime_energy_output_raw(star)
        lifetime_energy_score = percentile_rank(lifetime_energy_series, lifetime_energy_raw) if lifetime_energy_raw is not None else 0.5

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
            + lifetime_energy_score * settings.STAR_VALUATION_LIFETIME_ENERGY_MARKET_WEIGHT
        ) / energy_weight_total
        energy_score = min(
            1.75,
            energy_score * (1.0 + lifetime_energy_score * settings.STAR_VALUATION_ENERGY_SENSITIVITY_MAX_BOOST),
        )
        combined_metals_score = (metals_score * settings.STAR_VALUATION_METALLICITY_WEIGHT) / metals_weight_total
        combined_metals_score = min(
            1.85,
            combined_metals_score * (1.0 + metals_score * settings.STAR_VALUATION_METALS_SENSITIVITY_MAX_BOOST),
        )

        baseline_multiplier = settings.STAR_VALUATION_BASELINE_MIN_MULTIPLIER + (
            settings.STAR_VALUATION_BASELINE_MAX_MULTIPLIER - settings.STAR_VALUATION_BASELINE_MIN_MULTIPLIER
        ) * baseline_score

        coolness_components: dict[str, Any] = {}
        prestige_components: dict[str, Any] = {}
        ordinary_coolness_premium = 0.0
        prestige_direct_premium = 0.0

        for field_name, getter, series, is_two_sided, weight in ordinary_coolness_fields:
            raw_value = getter(star)
            if raw_value is None or not series:
                continue
            rarity_percentile = (
                _absolute_distance_percentile(series, raw_value)
                if is_two_sided
                else percentile_rank(series, raw_value)
            )
            tail_bonus = _tail_bonus_from_percentile(rarity_percentile)
            premium_fraction = tail_bonus * weight
            coolness_components[field_name] = {
                "raw_value": raw_value,
                "rarity_percentile": round(rarity_percentile, 6),
                "tail_bonus": round(tail_bonus, 6),
                "weight": round(weight, 6),
                "premium_fraction": round(premium_fraction, 6),
            }
            ordinary_coolness_premium += premium_fraction

        binary_probability = _binary_probability_value(star)
        if binary_probability is not None:
            binary_percentile = percentile_rank(binary_probability_series, binary_probability) if binary_probability_series else binary_probability
            binary_tail_bonus = _tail_bonus_from_percentile(binary_percentile)
            binary_signal = max(binary_probability, 0.65 if star.non_single_star else 0.0)
            binary_premium = binary_tail_bonus * settings.STAR_VALUATION_COOLNESS_BINARY_WEIGHT * binary_signal
            coolness_components["binary_collectible"] = {
                "raw_value": round(binary_probability, 6),
                "rarity_percentile": round(binary_percentile, 6),
                "tail_bonus": round(binary_tail_bonus, 6),
                "weight": round(settings.STAR_VALUATION_COOLNESS_BINARY_WEIGHT, 6),
                "premium_fraction": round(binary_premium, 6),
            }
            ordinary_coolness_premium += binary_premium

        prestige_core_scores: list[dict[str, float | str]] = []
        for trait_name, component_name, getter, series in prestige_fields:
            raw_value = getter(star)
            if raw_value is None:
                continue
            local_percentile = percentile_rank(series, raw_value) if series else 0.0
            absolute_score = (
                min(1.0, raw_value / max(settings.star_valuation_evolstage_premiums.values(), default=1.0))
                if trait_name == "evolstage"
                else _prestige_absolute_score(trait_name, raw_value)
            )
            effective_score = (
                settings.STAR_VALUATION_PRESTIGE_LOCAL_WEIGHT * local_percentile
                + settings.STAR_VALUATION_PRESTIGE_ABSOLUTE_WEIGHT * absolute_score
            )
            tail_bonus = _tail_bonus_from_percentile(effective_score)
            weight = settings.star_valuation_prestige_weights.get(trait_name, 0.0)
            premium_fraction = tail_bonus * weight
            prestige_components[component_name] = {
                "raw_value": round(raw_value, 6),
                "local_percentile": round(local_percentile, 6),
                "absolute_score": round(absolute_score, 6),
                "effective_score": round(effective_score, 6),
                "tail_bonus": round(tail_bonus, 6),
                "weight": round(weight, 6),
                "premium_fraction": round(premium_fraction, 6),
            }
            prestige_direct_premium += premium_fraction
            if trait_name != "evolstage":
                prestige_core_scores.append(
                    {
                        "trait": trait_name,
                        "effective_score": effective_score,
                        "absolute_score": absolute_score,
                    }
                )

        top_trait_count = max(1, settings.STAR_VALUATION_PRESTIGE_COMPOUND_TOP_TRAITS)
        top_core_scores = sorted(
            prestige_core_scores,
            key=lambda item: float(item["effective_score"]),
            reverse=True,
        )[:top_trait_count]
        compound_strength = 0.0
        if len(top_core_scores) == top_trait_count:
            compound_strength = 1.0
            for item in top_core_scores:
                compound_strength *= float(item["effective_score"])

        elite_count = sum(
            1
            for item in prestige_core_scores
            if float(item["effective_score"]) >= settings.STAR_VALUATION_PRESTIGE_COMPOUND_ELITE_DEPTH_THRESHOLD
            and float(item["absolute_score"]) >= 0.72
        )
        apex_count = sum(
            1
            for item in prestige_core_scores
            if float(item["effective_score"]) >= settings.STAR_VALUATION_PRESTIGE_COMPOUND_APEX_DEPTH_THRESHOLD
            and float(item["absolute_score"]) >= 0.9
        )
        compound_bonus = _prestige_compound_bonus(compound_strength)
        depth_factor = (
            1.0
            + max(0, elite_count - 2) * settings.STAR_VALUATION_PRESTIGE_COMPOUND_ELITE_DEPTH_BONUS
            + max(0, apex_count - 1) * settings.STAR_VALUATION_PRESTIGE_COMPOUND_APEX_DEPTH_BONUS
        )
        prestige_compound_premium = min(
            settings.STAR_VALUATION_PRESTIGE_COMPOUND_CAP,
            compound_bonus * depth_factor,
        ) if compound_bonus > 0 else 0.0

        prestige_components["compound_prestige"] = {
            "top_traits": [item["trait"] for item in top_core_scores],
            "compound_strength": round(compound_strength, 6),
            "elite_count": elite_count,
            "apex_count": apex_count,
            "base_bonus": round(compound_bonus, 6),
            "depth_factor": round(depth_factor, 6),
            "premium_fraction": round(prestige_compound_premium, 6),
        }

        total_coolness_premium = min(
            settings.STAR_VALUATION_COOLNESS_CAP,
            ordinary_coolness_premium + prestige_direct_premium + prestige_compound_premium,
        )
        cached_scores = {
            "baseline_score": round(baseline_score, 6),
            "energy_score": round(energy_score, 6),
            "metals_score": round(combined_metals_score, 6),
            "lifetime_energy_score": round(lifetime_energy_score, 6),
            "baseline_multiplier": round(baseline_multiplier, 6),
            "ordinary_coolness_premium": round(ordinary_coolness_premium, 6),
            "prestige_direct_premium": round(prestige_direct_premium, 6),
            "prestige_compound_premium": round(prestige_compound_premium, 6),
            "coolness_premium": round(total_coolness_premium, 6),
            "components": {**coolness_components, **prestige_components},
        }

        bundles[star.id] = StarScoreBundle(
            baseline_score=baseline_score,
            energy_score=energy_score,
            metals_score=combined_metals_score,
            baseline_multiplier=baseline_multiplier,
            coolness_premium=total_coolness_premium,
            cached_scores=cached_scores,
        )
    return bundles


def compute_model_value(
    first_purchase_price: Decimal,
    score_bundle: StarScoreBundle,
    energy_change_ratio: Optional[float],
    metals_change_ratio: Optional[float],
) -> Decimal:
    baseline_value = first_purchase_price * Decimal(str(score_bundle.baseline_multiplier))
    coolness_multiplier = Decimal(str(1.0 + score_bundle.coolness_premium))
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
    return max(value_floor, (baseline_value * coolness_multiplier * market_multiplier)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def build_valuation_debug(
    first_purchase_price: Decimal,
    score_bundle: StarScoreBundle,
    energy_change_ratio: Optional[float],
    metals_change_ratio: Optional[float],
) -> dict[str, Any]:
    baseline_value = float((first_purchase_price * Decimal(str(score_bundle.baseline_multiplier))).quantize(Decimal("0.0001")))
    coolness_multiplier = 1.0 + score_bundle.coolness_premium
    energy_change = energy_change_ratio or 0.0
    metals_change = metals_change_ratio or 0.0
    market_multiplier = (
        1.0
        + energy_change * settings.STAR_VALUATION_ENERGY_IMPACT_MULTIPLIER * score_bundle.energy_score
        + metals_change * settings.STAR_VALUATION_METALS_IMPACT_MULTIPLIER * score_bundle.metals_score
    )
    final_value = compute_model_value(
        first_purchase_price=first_purchase_price,
        score_bundle=score_bundle,
        energy_change_ratio=energy_change_ratio,
        metals_change_ratio=metals_change_ratio,
    )
    return {
        "first_purchase_price": float(first_purchase_price),
        "baseline": {
            "baseline_score": score_bundle.cached_scores["baseline_score"],
            "baseline_multiplier": score_bundle.cached_scores["baseline_multiplier"],
            "baseline_value": baseline_value,
        },
        "market": {
            "energy_change_ratio": round(energy_change, 6),
            "metals_change_ratio": round(metals_change, 6),
            "energy_score": score_bundle.cached_scores["energy_score"],
            "metals_score": score_bundle.cached_scores["metals_score"],
            "lifetime_energy_score": score_bundle.cached_scores.get("lifetime_energy_score"),
            "market_multiplier": round(market_multiplier, 6),
        },
        "coolness": {
            "ordinary_premium_fraction": score_bundle.cached_scores.get("ordinary_coolness_premium"),
            "prestige_direct_premium_fraction": score_bundle.cached_scores.get("prestige_direct_premium"),
            "prestige_compound_premium_fraction": score_bundle.cached_scores.get("prestige_compound_premium"),
            "total_premium_fraction": score_bundle.cached_scores["coolness_premium"],
            "coolness_multiplier": round(coolness_multiplier, 6),
            "components": score_bundle.cached_scores["components"],
        },
        "final_model_value": float(final_value),
    }


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
        latest_model_value = compute_model_value(
            first_purchase_price=first_purchase_price,
            score_bundle=bundles[star.id],
            energy_change_ratio=0.0,
            metals_change_ratio=0.0,
        )
        latest_debug = build_valuation_debug(
            first_purchase_price=first_purchase_price,
            score_bundle=bundles[star.id],
            energy_change_ratio=0.0,
            metals_change_ratio=0.0,
        )
        if latest_input is not None:
            latest_model_value = compute_model_value(
                first_purchase_price=first_purchase_price,
                score_bundle=bundles[star.id],
                energy_change_ratio=latest_input.energy_change_ratio,
                metals_change_ratio=latest_input.metals_change_ratio,
            )
            latest_debug = build_valuation_debug(
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
        star.valuation_scores = bundles[star.id].cached_scores
        star.valuation_debug = latest_debug
        updated_star_rows += 1

    await db.flush()
    return {
        "stars_seen": len(stars),
        "eligible_stars": len(bundles),
        "history_rows_created": created_history_rows,
        "stars_updated": updated_star_rows,
    }
