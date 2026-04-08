#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import json
import os
import random
import sys
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.external_market_input import ExternalMarketInput
from app.models.star import Star
from app.models.transaction import Transaction
from app.services.gaia_valuation import (
    GaiaValuationCandidate,
    row_to_valuation_candidate,
    tap_query_rows,
)
from app.services.star_valuation import (
    build_star_score_bundles,
    compute_model_value,
    money_decimal,
    recalculate_model_values,
)
from scripts.backfill_star_valuations import apply_secondary_metric_fallbacks, replace_star_identity_from_candidate


engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

REPORT_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "app",
    "data",
    "prestige_gaia_replacement_report.json",
)

DISTANCE_SHELLS_PC = [
    (0.0, 100.0),
    (100.0, 200.0),
    (200.0, 400.0),
    (400.0, 800.0),
    (800.0, 1600.0),
    (1600.0, 3200.0),
    (3200.0, 6400.0),
    (6400.0, 12800.0),
    (12800.0, 22000.0),
    (22000.0, 32000.0),
]

PRESTIGE_ORDERINGS = [
    ("luminosity", "ap.lum_flame DESC, ap.mass_flame DESC, ap.radius_flame DESC, ap.age_flame DESC, gs.source_id ASC"),
    ("mass", "ap.mass_flame DESC, ap.lum_flame DESC, ap.radius_flame DESC, ap.age_flame DESC, gs.source_id ASC"),
    ("radius", "ap.radius_flame DESC, ap.lum_flame DESC, ap.mass_flame DESC, ap.age_flame DESC, gs.source_id ASC"),
    ("age", "ap.age_flame DESC, ap.lum_flame DESC, ap.radius_flame DESC, ap.mass_flame DESC, gs.source_id ASC"),
]


@dataclass
class ReplacementPlan:
    target_star: Star
    candidate: GaiaValuationCandidate
    predicted_value: float
    old_distance_pc: float


def shell_label(lo: float, hi: float) -> str:
    return f"{int(lo)}-{int(hi)} pc"


def shell_for_distance(distance_pc: float) -> tuple[float, float]:
    for lo, hi in DISTANCE_SHELLS_PC:
        if lo <= distance_pc < hi:
            return lo, hi
    return DISTANCE_SHELLS_PC[-1]


def build_prestige_query(lo: float, hi: float, top: int, order_clause: str) -> str:
    return f"""
SELECT TOP {top}
    gs.source_id,
    gs.ra,
    gs.dec,
    gs.phot_g_mean_mag,
    gs.bp_rp,
    gs.phot_bp_mean_mag,
    gs.phot_rp_mean_mag,
    gs.parallax,
    gs.pm,
    gs.pmra,
    gs.pmdec,
    gs.radial_velocity,
    gs.non_single_star,
    gs.phot_variable_flag,
    ap.distance_gspphot,
    ap.mg_gspphot,
    ap.lum_flame,
    ap.spectraltype_esphs,
    ap.teff_gspphot,
    ap.mh_gspphot,
    ap.radius_flame,
    ap.mass_flame,
    ap.age_flame,
    ap.evolstage_flame,
    vc.best_class_name
FROM gaiadr3.gaia_source gs
JOIN gaiadr3.astrophysical_parameters ap ON gs.source_id = ap.source_id
LEFT OUTER JOIN (
    SELECT source_id, MAX(best_class_name) AS best_class_name
    FROM gaiadr3.vari_classifier_result
    GROUP BY source_id
) vc ON gs.source_id = vc.source_id
WHERE gs.random_index IS NOT NULL
  AND ap.distance_gspphot >= {lo}
  AND ap.distance_gspphot < {hi}
  AND gs.phot_g_mean_mag IS NOT NULL
  AND gs.parallax IS NOT NULL
  AND gs.non_single_star IS NOT NULL
  AND gs.phot_variable_flag IS NOT NULL
  AND ap.distance_gspphot IS NOT NULL
  AND ap.distance_gspphot > 0
  AND ap.lum_flame IS NOT NULL
  AND ap.teff_gspphot IS NOT NULL
  AND ap.mh_gspphot IS NOT NULL
  AND ap.radius_flame IS NOT NULL
  AND ap.age_flame IS NOT NULL
  AND vc.best_class_name IS NOT NULL
ORDER BY {order_clause}
""".strip()


def fetch_shell_rows(lo: float, hi: float, top: int) -> tuple[list[dict[str, str]], list[dict[str, int | str]]]:
    merged_rows: list[dict[str, str]] = []
    seen_source_ids: set[str] = set()
    diagnostics: list[dict[str, int | str]] = []
    per_order_top = max(60, top)
    for ordering_name, order_clause in PRESTIGE_ORDERINGS:
        attempts: list[int] = []
        last_error: Exception | None = None
        used_top = per_order_top
        rows: list[dict[str, str]] = []
        status = "ok"
        error_text = ""
        for candidate_top in (per_order_top, max(125, per_order_top // 2), 80):
            if candidate_top in attempts:
                continue
            attempts.append(candidate_top)
            used_top = candidate_top
            for _ in range(2):
                try:
                    rows = tap_query_rows(
                        build_prestige_query(lo, hi, candidate_top, order_clause),
                        timeout=240,
                    )
                    last_error = None
                    break
                except Exception as exc:
                    last_error = exc
            if rows:
                break
        if last_error is not None and not rows:
            status = "error"
            error_text = str(last_error)

        diagnostics.append(
            {
                "ordering": ordering_name,
                "used_top": used_top,
                "rows": len(rows),
                "status": status,
                "error": error_text,
            }
        )
        for row in rows:
            source_id = str(row.get("source_id") or "").strip()
            if not source_id or source_id in seen_source_ids:
                continue
            seen_source_ids.add(source_id)
            merged_rows.append(row)

    return merged_rows, diagnostics


def candidate_to_temp_star(candidate: GaiaValuationCandidate, temp_id: int) -> Star:
    star = Star(
        id=temp_id,
        scientific_name=f"__TEMP_GAIA__{candidate.source_id}",
        display_name=f"__TEMP_GAIA__{candidate.source_id}",
        category=candidate.category,
        x=candidate.x,
        y=candidate.y,
        z=candidate.z,
        distance_ly=candidate.distance_ly,
    )
    star.common_name = None
    star.source_catalog = "Gaia DR3"
    star.source_id = candidate.source_id
    star.gaia_source_id = candidate.source_id
    star.catalog_id = f"GAIA DR3 {candidate.source_id}"
    star.canonical_id = f"GAIA DR3 {candidate.source_id}"
    star.identifier_type = "gaia_source_id"
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
    star.bp_rp = candidate.bp_rp
    star.bp_g = candidate.bp_g
    star.g_rp = candidate.g_rp
    star.radial_velocity = candidate.radial_velocity
    star.pm = candidate.pm
    star.pmra = candidate.pmra
    star.pmdec = candidate.pmdec
    star.phot_g_mean_mag = candidate.phot_g_mean_mag
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
    star.is_bought = False
    return star


async def build_transaction_counts(db: AsyncSession) -> dict[int, int]:
    result = await db.execute(
        select(Transaction.star_id, func.count(Transaction.id))
        .group_by(Transaction.star_id)
    )
    return {star_id: count for star_id, count in result.all()}


async def fetch_latest_market_input(db: AsyncSession) -> ExternalMarketInput | None:
    result = await db.execute(
        select(ExternalMarketInput)
        .where(ExternalMarketInput.provider == settings.STAR_VALUATION_PROVIDER)
        .order_by(ExternalMarketInput.market_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def score_candidates(
    current_stars: list[Star],
    candidates: list[GaiaValuationCandidate],
    latest_market_input: ExternalMarketInput | None,
) -> dict[str, tuple[float, Star]]:
    if not candidates:
        return {}

    temp_stars = [
        candidate_to_temp_star(candidate, -1_000_000 - index)
        for index, candidate in enumerate(candidates)
    ]
    bundles = build_star_score_bundles(current_stars + temp_stars)
    first_purchase_price = money_decimal(settings.STAR_ISSUE_PRICE)
    energy_change = float(latest_market_input.energy_change_ratio) if latest_market_input else 0.0
    metals_change = float(latest_market_input.metals_change_ratio) if latest_market_input else 0.0

    scored: dict[str, tuple[float, Star]] = {}
    for candidate, temp_star in zip(candidates, temp_stars):
        bundle = bundles.get(temp_star.id)
        if bundle is None:
            continue
        model_value = compute_model_value(
            first_purchase_price=first_purchase_price,
            score_bundle=bundle,
            energy_change_ratio=energy_change,
            metals_change_ratio=metals_change,
        )
        scored[candidate.source_id] = (float(model_value), temp_star)
    return scored


def choose_replacements(
    targets: list[Star],
    candidates: list[GaiaValuationCandidate],
    scored_candidates: dict[str, tuple[float, Star]],
    used_source_ids: set[str],
    rng: random.Random,
    target_min_value: float,
    target_max_value: float,
) -> list[ReplacementPlan]:
    if not targets or not candidates:
        return []

    eligible_candidates = []
    for candidate in candidates:
        scored = scored_candidates.get(candidate.source_id)
        if not scored:
            continue
        predicted_value, _ = scored
        if not (target_min_value <= predicted_value <= target_max_value):
            continue
        if candidate.source_id in used_source_ids:
            continue
        eligible_candidates.append((candidate, predicted_value))

    if not eligible_candidates:
        return []

    randomized_targets = list(targets)
    rng.shuffle(randomized_targets)

    plans: list[ReplacementPlan] = []
    available_candidates = list(eligible_candidates)
    for target in randomized_targets:
        target_distance = float(target.distance_parsecs or 0.0)
        available_candidates.sort(
            key=lambda item: (
                abs(item[0].distance_parsecs - target_distance),
                -item[1],
                int(item[0].source_id),
            )
        )
        candidate, predicted_value = available_candidates.pop(0)
        used_source_ids.add(candidate.source_id)
        plans.append(
            ReplacementPlan(
                target_star=target,
                candidate=candidate,
                predicted_value=predicted_value,
                old_distance_pc=target_distance,
            )
        )
        if not available_candidates:
            break

    return plans


async def main() -> None:
    parser = argparse.ArgumentParser(description="Replace a few hundred Gaia stars with higher-prestige Gaia DR3 entries.")
    parser.add_argument("--count", type=int, default=300)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--min-value", type=float, default=30.0)
    parser.add_argument("--max-value", type=float, default=100.0)
    parser.add_argument("--top-per-shell", type=int, default=900)
    parser.add_argument("--max-distance-pc", type=float, default=32000.0)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    rng = random.Random(args.seed)

    async with AsyncSessionLocal() as db:
        stars = list((await db.execute(select(Star).order_by(Star.id.asc()))).scalars().all())
        transaction_counts = await build_transaction_counts(db)
        latest_market_input = await fetch_latest_market_input(db)

        replaceable_stars = [
            star
            for star in stars
            if not star.common_name
            and (star.source_catalog == "Gaia DR3" or star.gaia_source_id)
            and not star.is_bought
            and transaction_counts.get(star.id, 0) == 0
        ]
        used_source_ids = {
            str(star.gaia_source_id or star.source_id or "").strip()
            for star in stars
            if str(star.gaia_source_id or star.source_id or "").strip()
        }

        targets_by_shell: dict[tuple[float, float], list[Star]] = defaultdict(list)
        for star in replaceable_stars:
            if float(star.model_value or 0.0) >= args.min_value:
                continue
            targets_by_shell[shell_for_distance(float(star.distance_parsecs or 0.0))].append(star)

        remaining = args.count
        replacement_plans: list[ReplacementPlan] = []

        report: dict[str, object] = {
            "seed": args.seed,
            "requested_replacements": args.count,
            "target_value_band": [args.min_value, args.max_value],
            "shells": {},
            "dry_run": args.dry_run,
            "run_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        }

        current_stars = stars

        for shell in DISTANCE_SHELLS_PC:
            if remaining <= 0:
                break
            if shell[0] >= args.max_distance_pc:
                continue
            shell_targets = list(targets_by_shell.get(shell, []))
            if not shell_targets:
                continue
            rng.shuffle(shell_targets)

            lo, hi = shell
            rows, ordering_diagnostics = fetch_shell_rows(lo, hi, args.top_per_shell)
            candidates: list[GaiaValuationCandidate] = []
            for row in rows:
                candidate = row_to_valuation_candidate(row)
                if candidate is None:
                    continue
                if candidate.source_id in used_source_ids:
                    continue
                candidates.append(candidate)

            scored = score_candidates(current_stars, candidates, latest_market_input)
            plans = choose_replacements(
                targets=shell_targets[:remaining],
                candidates=candidates,
                scored_candidates=scored,
                used_source_ids=used_source_ids,
                rng=rng,
                target_min_value=args.min_value,
                target_max_value=args.max_value,
            )

            replacement_plans.extend(plans)
            remaining -= len(plans)

            report["shells"][shell_label(lo, hi)] = {
                "targets_available": len(shell_targets),
                "requested_top_per_ordering": args.top_per_shell,
                "candidate_rows": len(rows),
                "candidates_scored": len(scored),
                "selected_replacements": len(plans),
                "ordering_diagnostics": ordering_diagnostics,
            }

        if not args.dry_run:
            for plan in replacement_plans:
                replace_star_identity_from_candidate(plan.target_star, plan.candidate)
                apply_secondary_metric_fallbacks(plan.target_star)

            await db.flush()
            valuation_summary = await recalculate_model_values(db)
            await db.commit()
            report["valuation_summary"] = valuation_summary

        report["completed_replacements"] = len(replacement_plans)
        report["sample_replacements"] = [
            {
                "star_id": plan.target_star.id,
                "new_source_id": plan.candidate.source_id,
                "old_distance_pc": round(plan.old_distance_pc, 3),
                "new_distance_pc": round(float(plan.candidate.distance_parsecs), 3),
                "predicted_value": round(plan.predicted_value, 2),
            }
            for plan in replacement_plans[:15]
        ]

        with open(REPORT_PATH, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, default=str)

        print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
