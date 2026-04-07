#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json
import math
import os
import sys
from collections import defaultdict
from datetime import date

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.transaction import Transaction
from app.models.star import Star
from app.services.gaia_valuation import (
    DEFAULT_VALUATION_DISTANCE_BINS_PC,
    REQUIRED_PRICING_METRICS,
    fetch_balanced_eligible_valuation_pool,
    radial_bin_label,
    transformed_renderer_position,
)
from app.services.market_inputs import MarketInputSnapshot, combine_market_history
from app.services.star_valuation import (
    missing_valuation_metrics,
    money_decimal,
    recalculate_model_values,
    sync_external_market_inputs,
)


engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
REPORT_PATH = os.path.join(os.path.dirname(__file__), "..", "app", "data", "valuation_backfill_report.json")
VALUATION_DISTANCE_BINS_PC = DEFAULT_VALUATION_DISTANCE_BINS_PC
VALUATION_TOP_PER_BIN = 1000
VALUATION_AZIMUTH_BINS = 18
VALUATION_LATITUDE_BINS = 8

SPECTRAL_TEMPERATURES = {
    "O": 32000.0,
    "B": 16000.0,
    "A": 9000.0,
    "F": 7000.0,
    "G": 5800.0,
    "K": 4500.0,
    "M": 3400.0,
    "C": 3200.0,
    "S": 3400.0,
    "W": 30000.0,
}

SPECTRAL_AGES = {
    "O": 0.02,
    "B": 0.08,
    "A": 0.6,
    "F": 2.5,
    "G": 5.0,
    "K": 8.5,
    "M": 11.0,
    "C": 9.0,
    "S": 9.0,
    "W": 0.05,
}


def apply_metrics_to_star(star: Star, candidate) -> None:
    star.gaia_source_id = candidate.source_id
    star.phot_g_mean_mag = candidate.phot_g_mean_mag
    star.bp_rp = candidate.bp_rp
    star.bp_g = candidate.bp_g
    star.g_rp = candidate.g_rp
    star.parallax = candidate.parallax
    star.lum_flame = candidate.lum_flame
    star.teff_gspphot = candidate.teff_gspphot
    star.mh_gspphot = candidate.mh_gspphot
    star.non_single_star = candidate.non_single_star
    star.phot_variable_flag = candidate.phot_variable_flag
    star.best_class_name = candidate.best_class_name
    star.radius_flame = candidate.radius_flame
    star.mass_flame = candidate.mass_flame
    star.age_flame = candidate.age_flame
    star.evolstage_flame = candidate.evolstage_flame
    star.classprob_dsc_combmod_binarystar = candidate.classprob_dsc_combmod_binarystar


def apply_solar_metrics(star: Star) -> None:
    star.gaia_source_id = "SOL"
    star.phot_g_mean_mag = -26.9
    star.bp_rp = 0.82
    star.bp_g = 0.33
    star.g_rp = 0.49
    star.parallax = 1_000_000.0
    star.lum_flame = 1.0
    star.teff_gspphot = 5772.0
    star.mh_gspphot = 0.0
    star.non_single_star = False
    star.phot_variable_flag = "CONSTANT"
    star.best_class_name = "SOLAR_LIKE"
    star.radius_flame = 1.0
    star.mass_flame = 1.0
    star.age_flame = 4.6
    star.evolstage_flame = 1.0
    star.classprob_dsc_combmod_binarystar = 0.0


def approximate_temperature_from_spectral_type(spectral_type: str | None) -> float:
    normalized = (spectral_type or "").strip().upper()
    for key, value in SPECTRAL_TEMPERATURES.items():
        if normalized.startswith(key):
            return value
    return 5772.0


def approximate_age_from_spectral_type(spectral_type: str | None) -> float:
    normalized = (spectral_type or "").strip().upper()
    for key, value in SPECTRAL_AGES.items():
        if normalized.startswith(key):
            return value
    return 5.0


def classify_named_star(star: Star, temperature: float, variable_flag: str) -> str:
    spectral = (star.spectral_type or "").strip().upper()
    category = (star.category or "").strip().upper()
    if variable_flag == "VARIABLE":
        if spectral.startswith(("M", "C", "S")) or "GIANT" in category or "SUPERGIANT" in category:
            return "LPV"
        if "SB" in spectral or bool(star.variable_designation):
            return "EA"
    if spectral.startswith(("F", "G")):
        return "SOLAR_LIKE"
    if spectral.startswith("M"):
        return "LPV" if "GIANT" in category else "ROT"
    if spectral.startswith(("O", "B")):
        return "GCAS"
    if spectral.startswith("A"):
        return "DSCT"
    if spectral.startswith("K"):
        return "BY_DRA"
    if temperature >= 7000:
        return "DSCT"
    return "SOLAR_LIKE"


def approximate_mass_from_luminosity(luminosity: float, category: str | None) -> float:
    if luminosity <= 0:
        return 1.0
    base_mass = max(0.08, luminosity ** (1.0 / 3.5))
    normalized_category = (category or "").upper()
    if "SUPERGIANT" in normalized_category:
        return min(60.0, max(base_mass, 12.0))
    if "GIANT" in normalized_category:
        return min(20.0, max(base_mass, 2.0))
    if "SUBGIANT" in normalized_category:
        return min(8.0, max(base_mass, 1.2))
    if "WHITE DWARF" in normalized_category:
        return min(1.4, max(0.5, base_mass * 0.5))
    return min(20.0, base_mass)


def approximate_evolstage(category: str | None, spectral_type: str | None) -> float:
    normalized_category = (category or "").upper()
    normalized_spectral = (spectral_type or "").upper()
    if "SUPERGIANT" in normalized_category:
        return 6.0
    if "GIANT" in normalized_category:
        return 4.0
    if "SUBGIANT" in normalized_category:
        return 3.0
    if "WHITE DWARF" in normalized_category or normalized_spectral.startswith("D"):
        return 7.0
    return 1.0


def apply_named_star_fallback_metrics(star: Star) -> None:
    distance_pc = float(star.distance_parsecs or 0.0)
    luminosity = max(float(star.luminosity or 1.0), 0.01)
    temperature = approximate_temperature_from_spectral_type(star.spectral_type)
    solar_temperature_ratio = temperature / 5772.0
    radius = max(0.05, math.sqrt(luminosity) / max(0.1, solar_temperature_ratio**2))

    variable_flag = "CONSTANT"
    if (
        star.variable_designation
        or ("VAR" in (star.spectral_type or "").upper())
        or (
            star.variable_min is not None
            and star.variable_max is not None
            and abs(float(star.variable_max) - float(star.variable_min)) >= 0.05
        )
    ):
        variable_flag = "VARIABLE"

    non_single_star = "SB" in (star.spectral_type or "").upper()
    metallicity = 0.0
    if star.color_index is not None:
        metallicity = max(-0.6, min(0.5, (0.65 - float(star.color_index)) * 0.25))
    mass = approximate_mass_from_luminosity(luminosity, star.category)
    evolstage = approximate_evolstage(star.category, star.spectral_type)
    proper_motion = None
    if star.pmra is not None and star.pmdec is not None:
        proper_motion = math.sqrt(float(star.pmra) ** 2 + float(star.pmdec) ** 2)
    binary_probability = 0.85 if non_single_star else 0.12

    star.phot_g_mean_mag = float(star.apparent_magnitude or star.absolute_magnitude or 0.0)
    star.bp_rp = float(star.color_index) if star.color_index is not None else None
    star.bp_g = None
    star.g_rp = None
    star.parallax = max(0.01, 1000.0 / distance_pc) if distance_pc > 0 else 1_000_000.0
    star.lum_flame = luminosity
    star.teff_gspphot = temperature
    star.mh_gspphot = metallicity
    star.non_single_star = non_single_star
    star.phot_variable_flag = variable_flag
    star.best_class_name = classify_named_star(star, temperature, variable_flag)
    star.radius_flame = radius
    star.mass_flame = mass
    star.age_flame = approximate_age_from_spectral_type(star.spectral_type)
    star.evolstage_flame = evolstage
    star.classprob_dsc_combmod_binarystar = binary_probability
    star.pm = proper_motion


def replace_star_identity_from_candidate(star: Star, candidate) -> None:
    canonical_id = f"GAIA DR3 {candidate.source_id}"
    star.catalog_id = canonical_id
    star.canonical_id = canonical_id
    star.identifier_type = "gaia_source_id"
    star.source_catalog = "Gaia DR3"
    star.source_id = candidate.source_id
    star.display_name = canonical_id
    star.scientific_name = canonical_id
    star.common_name = None
    star.category = candidate.category
    star.x = candidate.x
    star.y = candidate.y
    star.z = candidate.z
    star.distance_ly = candidate.distance_ly
    star.constellation = candidate.constellation
    star.spectral_type = candidate.spectral_type
    star.ra_degrees = candidate.ra_degrees
    star.ra_hours = candidate.ra_degrees / 15.0
    star.dec_degrees = candidate.dec_degrees
    star.distance_parsecs = candidate.distance_parsecs
    star.galactic_longitude_deg = candidate.galactic_longitude_deg
    star.galactic_latitude_deg = candidate.galactic_latitude_deg
    star.x_pc = candidate.x_pc
    star.y_pc = candidate.y_pc
    star.z_pc = candidate.z_pc
    star.apparent_magnitude = candidate.phot_g_mean_mag
    star.absolute_magnitude = candidate.absolute_magnitude
    star.luminosity = candidate.luminosity
    star.color_index = candidate.color_index
    star.radial_velocity = candidate.radial_velocity
    star.pm = candidate.pm
    star.pmra = candidate.pmra
    star.pmdec = candidate.pmdec
    apply_metrics_to_star(star, candidate)


def hydrate_existing_gaia_star_from_candidate(star: Star, candidate) -> None:
    star.category = candidate.category
    star.constellation = candidate.constellation
    star.spectral_type = candidate.spectral_type
    star.apparent_magnitude = candidate.phot_g_mean_mag
    star.absolute_magnitude = candidate.absolute_magnitude
    star.luminosity = candidate.luminosity
    star.color_index = candidate.color_index
    star.radial_velocity = candidate.radial_velocity
    star.pm = candidate.pm
    star.pmra = candidate.pmra
    star.pmdec = candidate.pmdec
    apply_metrics_to_star(star, candidate)


def apply_secondary_metric_fallbacks(star: Star) -> None:
    if star.bp_rp is None and star.color_index is not None:
        star.bp_rp = float(star.color_index)
    if star.pm is None and star.pmra is not None and star.pmdec is not None:
        star.pm = math.sqrt(float(star.pmra) ** 2 + float(star.pmdec) ** 2)
    if star.mass_flame is None:
        luminosity = float(star.lum_flame or star.luminosity or 0.0)
        if luminosity > 0:
            star.mass_flame = approximate_mass_from_luminosity(luminosity, star.category)
    if star.evolstage_flame is None:
        star.evolstage_flame = approximate_evolstage(star.category, star.spectral_type)
    if star.classprob_dsc_combmod_binarystar is None and star.non_single_star is not None:
        star.classprob_dsc_combmod_binarystar = 0.85 if star.non_single_star else 0.05


def assign_radial_bin(distance_pc: float, bin_edges: list[float]) -> int:
    for index, (lo, hi) in enumerate(zip(bin_edges[:-1], bin_edges[1:])):
        if lo <= distance_pc < hi:
            return index
    return len(bin_edges) - 2


def compute_radial_quotas(candidates: list, bin_edges: list[float], target_count: int) -> dict[int, int]:
    by_bin: dict[int, list] = defaultdict(list)
    for candidate in candidates:
        by_bin[assign_radial_bin(candidate.distance_parsecs, bin_edges)].append(candidate)
    remaining = target_count
    active_bins = {index for index, items in by_bin.items() if items}
    quotas = {index: 0 for index in range(len(bin_edges) - 1)}

    while active_bins and remaining > 0:
        share = max(1, remaining // len(active_bins))
        exhausted = set()
        for index in list(active_bins):
            available = len(by_bin[index]) - quotas[index]
            take = min(share, available)
            quotas[index] += take
            remaining -= take
            if quotas[index] >= len(by_bin[index]):
                exhausted.add(index)
            if remaining <= 0:
                break
        active_bins -= exhausted
        if share == 1 and not exhausted and remaining > 0:
            for index in list(active_bins):
                if remaining <= 0:
                    break
                available = len(by_bin[index]) - quotas[index]
                if available > 0:
                    quotas[index] += 1
                    remaining -= 1
    return quotas


def separation_grid_key(x_pc: float, y_pc: float, z_pc: float, cell_size: float) -> tuple[int, int, int]:
    return (
        int(math.floor(x_pc / cell_size)),
        int(math.floor(y_pc / cell_size)),
        int(math.floor(z_pc / cell_size)),
    )


def candidate_is_far_enough(candidate, grid: dict[tuple[int, int, int], list], min_separation_pc: float) -> bool:
    if min_separation_pc <= 0:
        return True
    gx, gy, gz = separation_grid_key(candidate.x_pc, candidate.y_pc, candidate.z_pc, min_separation_pc)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for other in grid.get((gx + dx, gy + dy, gz + dz), []):
                    dist = math.sqrt(
                        (candidate.x_pc - other.x_pc) ** 2
                        + (candidate.y_pc - other.y_pc) ** 2
                        + (candidate.z_pc - other.z_pc) ** 2
                    )
                    if dist < min_separation_pc:
                        return False
    return True


def build_shell_cells(candidates: list, azimuth_bins: int, latitude_bins: int) -> dict[tuple[int, int], list]:
    cells: dict[tuple[int, int], list] = defaultdict(list)
    for candidate in candidates:
        azimuth_index = min(
            azimuth_bins - 1,
            max(0, int((candidate.galactic_longitude_deg % 360.0) / 360.0 * azimuth_bins)),
        )
        latitude_position = (math.sin(math.radians(candidate.galactic_latitude_deg)) + 1.0) * 0.5
        latitude_index = min(latitude_bins - 1, max(0, int(latitude_position * latitude_bins)))
        cells[(azimuth_index, latitude_index)].append(candidate)
    for key in cells:
        cells[key].sort(key=lambda item: (item.phot_g_mean_mag, int(item.source_id)))
    return cells


def select_from_shell(
    candidates: list,
    quota: int,
    azimuth_bins: int,
    latitude_bins: int,
    selected_grid: dict[tuple[int, int, int], list],
    min_separation_pc: float,
) -> list:
    if quota <= 0:
        return []
    shell_cells = build_shell_cells(candidates, azimuth_bins, latitude_bins)
    ordered_keys = sorted(shell_cells.keys(), key=lambda key: (-len(shell_cells[key]), key))
    chosen: list = []

    while len(chosen) < quota and ordered_keys:
        next_keys: list[tuple[int, int]] = []
        progress = False
        for key in ordered_keys:
            bucket = shell_cells[key]
            while bucket:
                candidate = bucket.pop(0)
                if candidate_is_far_enough(candidate, selected_grid, min_separation_pc):
                    chosen.append(candidate)
                    grid_key = separation_grid_key(
                        candidate.x_pc,
                        candidate.y_pc,
                        candidate.z_pc,
                        max(min_separation_pc, 1.0),
                    )
                    selected_grid[grid_key].append(candidate)
                    progress = True
                    break
            if bucket:
                next_keys.append(key)
            if len(chosen) >= quota:
                break
        if not progress:
            break
        ordered_keys = next_keys

    if len(chosen) < quota:
        leftovers = []
        for bucket in shell_cells.values():
            leftovers.extend(bucket)
        leftovers.sort(key=lambda item: (item.phot_g_mean_mag, int(item.source_id)))
        for candidate in leftovers:
            if len(chosen) >= quota:
                break
            chosen.append(candidate)
            grid_key = separation_grid_key(
                candidate.x_pc,
                candidate.y_pc,
                candidate.z_pc,
                max(min_separation_pc, 1.0),
            )
            selected_grid[grid_key].append(candidate)
    return chosen[:quota]


def select_balanced_candidates(candidates: list, target_count: int, bin_edges: list[float]) -> tuple[list, dict[str, object]]:
    quotas = compute_radial_quotas(candidates, bin_edges, target_count)
    by_shell: dict[int, list] = defaultdict(list)
    for candidate in candidates:
        by_shell[assign_radial_bin(candidate.distance_parsecs, bin_edges)].append(candidate)

    x_values = [candidate.x_pc for candidate in candidates]
    y_values = [candidate.y_pc for candidate in candidates]
    z_values = [candidate.z_pc for candidate in candidates]
    volume = max(max(x_values) - min(x_values), 1.0) * max(max(y_values) - min(y_values), 1.0) * max(max(z_values) - min(z_values), 1.0)
    base_spacing = max(5.0, (volume / max(target_count, 1)) ** (1.0 / 3.0) * 0.18)

    selected: list = []
    shell_counts: dict[str, int] = {}
    separation_attempts: list[float] = []

    for factor in (1.0, 0.8, 0.6, 0.4, 0.25, 0.1, 0.0):
        selected = []
        selected_grid: dict[tuple[int, int, int], list] = defaultdict(list)
        shell_counts = {}
        min_separation_pc = base_spacing * factor
        separation_attempts.append(min_separation_pc)

        for shell_index in range(len(bin_edges) - 1):
            quota = quotas.get(shell_index, 0)
            shell_candidates = list(by_shell.get(shell_index, []))
            label = radial_bin_label(bin_edges[shell_index], bin_edges[shell_index + 1])
            if quota <= 0 or not shell_candidates:
                shell_counts[label] = 0
                continue
            chosen = select_from_shell(
                shell_candidates,
                quota,
                VALUATION_AZIMUTH_BINS,
                VALUATION_LATITUDE_BINS,
                selected_grid,
                min_separation_pc,
            )
            selected.extend(chosen)
            shell_counts[label] = len(chosen)
        if len(selected) >= target_count:
            break

    if len(selected) < target_count:
        selected_by_id = {candidate.source_id: candidate for candidate in selected}
        for shell_index in range(len(bin_edges) - 1):
            quota = quotas.get(shell_index, 0)
            label = radial_bin_label(bin_edges[shell_index], bin_edges[shell_index + 1])
            current_count = shell_counts.get(label, 0)
            if current_count >= quota:
                continue
            shell_candidates = list(by_shell.get(shell_index, []))
            shell_candidates.sort(key=lambda item: (item.phot_g_mean_mag, int(item.source_id)))
            for candidate in shell_candidates:
                if current_count >= quota:
                    break
                if candidate.source_id in selected_by_id:
                    continue
                selected.append(candidate)
                selected_by_id[candidate.source_id] = candidate
                current_count += 1
            shell_counts[label] = current_count

    selected = selected[:target_count]
    return selected, {
        "radial_quotas": {
            radial_bin_label(bin_edges[index], bin_edges[index + 1]): quotas.get(index, 0)
            for index in range(len(bin_edges) - 1)
        },
        "radial_selected_counts": shell_counts,
        "base_spacing_pc": round(base_spacing, 3),
        "separation_attempts_pc": [round(value, 3) for value in separation_attempts],
        "selected_count": len(selected),
    }


def apply_ranked_renderer_positions(candidates: list) -> None:
    ordered = sorted(candidates, key=lambda item: (item.distance_parsecs, int(item.source_id)))
    total = max(len(ordered) - 1, 1)
    for index, candidate in enumerate(ordered):
        normalized_distance = index / total
        candidate.x, candidate.y, candidate.z = transformed_renderer_position(
            candidate.galactic_longitude_deg,
            candidate.galactic_latitude_deg,
            normalized_distance,
        )


async def build_transaction_counts(db: AsyncSession) -> dict[int, int]:
    result = await db.execute(
        select(Transaction.star_id, func.count(Transaction.id))
        .group_by(Transaction.star_id)
    )
    return {star_id: count for star_id, count in result.all()}


async def main() -> None:
    async with AsyncSessionLocal() as db:
        stars_result = await db.execute(select(Star).order_by(Star.id.asc()))
        stars = list(stars_result.scalars().all())
        transaction_counts = await build_transaction_counts(db)
        reserved_source_ids = {
            str(star.gaia_source_id or star.source_id or "").strip()
            for star in stars
            if str(star.gaia_source_id or star.source_id or "").strip()
        }
        rebalanceable_generic_stars = [
            star
            for star in stars
            if (not star.common_name)
            and (star.source_catalog == "Gaia DR3" or star.gaia_source_id)
            and not star.is_bought
            and transaction_counts.get(star.id, 0) == 0
        ]
        current_generic_source_ids = [
            str(star.gaia_source_id or star.source_id or "").strip()
            for star in rebalanceable_generic_stars
            if str(star.gaia_source_id or star.source_id or "").strip()
        ]
        reserved_source_ids -= {
            str(star.gaia_source_id or star.source_id or "").strip()
            for star in rebalanceable_generic_stars
            if str(star.gaia_source_id or star.source_id or "").strip()
        }

        report: dict[str, object] = {
            "stars_scanned": len(stars),
            "hydrated": 0,
            "named_star_fallbacks": 0,
            "replaced": 0,
            "manual_review": [],
            "ineligible_after_pass": [],
            "required_metrics": list(REQUIRED_PRICING_METRICS),
        }

        generic_targets = sorted(
            rebalanceable_generic_stars,
            key=lambda item: (float(item.distance_parsecs or 0.0), item.id),
        )
        selected_replacement_by_star_id = {}
        try:
            balanced_pool, pool_diagnostics = fetch_balanced_eligible_valuation_pool(
                distance_bins_pc=VALUATION_DISTANCE_BINS_PC,
                top_per_bin=VALUATION_TOP_PER_BIN,
            )
            report["eligible_pool_by_distance_bin"] = pool_diagnostics

            rebalance_candidates = [
                candidate
                for candidate in balanced_pool
                if candidate.source_id not in reserved_source_ids
            ]
            balanced_selection, balanced_selection_diagnostics = select_balanced_candidates(
                rebalance_candidates,
                len(rebalanceable_generic_stars),
                VALUATION_DISTANCE_BINS_PC,
            )
            apply_ranked_renderer_positions(balanced_selection)
            report["generic_rebalance"] = {
                **balanced_selection_diagnostics,
                "target_star_count": len(rebalanceable_generic_stars),
                "available_candidate_count": len(rebalance_candidates),
            }

            if len(balanced_selection) < len(rebalanceable_generic_stars):
                report["generic_rebalance"]["warning"] = (
                    f"Only {len(balanced_selection)} eligible Gaia candidates were selected for "
                    f"{len(rebalanceable_generic_stars)} generic stars."
                )

            balanced_replacements = sorted(
                balanced_selection,
                key=lambda item: (item.distance_parsecs, int(item.source_id)),
            )
            selected_replacement_by_star_id = {
                star.id: candidate
                for star, candidate in zip(generic_targets, balanced_replacements)
            }
            report["replaced"] = len(selected_replacement_by_star_id)
        except Exception as exc:
            report["generic_rebalance"] = {
                "warning": f"Balanced Gaia replacement pool unavailable, preserving current distribution: {exc}",
                "target_star_count": len(rebalanceable_generic_stars),
            }
            report["replaced"] = 0

        if selected_replacement_by_star_id:
            for star in generic_targets:
                star.scientific_name = f"__REBALANCE_PENDING__{star.id}"
            await db.flush()

        for star in stars:
            star.issue_price = money_decimal(settings.STAR_ISSUE_PRICE)

            safe_to_replace = not star.is_bought and transaction_counts.get(star.id, 0) == 0
            unresolved_named_star = bool(star.common_name) and star.source_catalog != "Gaia DR3"
            if star.canonical_id == "SOL":
                apply_solar_metrics(star)
                report["hydrated"] += 1
            elif unresolved_named_star:
                apply_named_star_fallback_metrics(star)
                report["hydrated"] += 1
                report["named_star_fallbacks"] += 1
            elif star.id in selected_replacement_by_star_id:
                replace_star_identity_from_candidate(star, selected_replacement_by_star_id[star.id])
                report["hydrated"] += 1
            else:
                current_source_id = str(star.gaia_source_id or star.source_id or "").strip()
                if current_source_id:
                    reserved_source_ids.add(current_source_id)

            apply_secondary_metric_fallbacks(star)

            missing = missing_valuation_metrics(star)
            star.valuation_eligible = not missing
            star.valuation_missing_metrics = missing or None
            if missing:
                reason = "named_star_manual_review" if unresolved_named_star else "missing_metrics_after_hydration"
                payload = {
                    "star_id": star.id,
                    "display_name": star.common_name or star.display_name or star.scientific_name,
                    "reason": reason,
                    "missing_metrics": missing,
                    "safe_to_replace": safe_to_replace,
                }
                report["manual_review"].append(payload)
                report["ineligible_after_pass"].append(payload)

        snapshots: list[MarketInputSnapshot] = []
        try:
            snapshots = combine_market_history(max_points=settings.STAR_VALUATION_MARKET_LOOKBACK_DAYS)
        except Exception as exc:
            report["market_input_warning"] = str(exc)
            snapshots = [
                MarketInputSnapshot(
                    provider=settings.STAR_VALUATION_PROVIDER,
                    market_date=date.today(),
                    energy_symbol=settings.STAR_VALUATION_ENERGY_SYMBOL,
                    metals_symbol=settings.STAR_VALUATION_METALS_SYMBOL,
                    energy_price=money_decimal(1),
                    metals_price=money_decimal(1),
                    energy_change_ratio=0.0,
                    metals_change_ratio=0.0,
                    raw_payload={"fallback": True},
                )
            ]

        synced_inputs = await sync_external_market_inputs(db, snapshots[-settings.STAR_VALUATION_HISTORY_BOOTSTRAP_DAYS :])
        valuation_summary = await recalculate_model_values(
            db,
            valuation_dates=[item.market_date for item in synced_inputs],
        )
        report["valuation_summary"] = valuation_summary

        await db.commit()

        with open(REPORT_PATH, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, default=str)

        print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
