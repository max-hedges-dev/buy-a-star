#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json
import math
import os
import sys
from collections import Counter

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.star import Star
from app.services.gaia_valuation import radial_bin_label, row_to_valuation_candidate, tap_query_rows
from app.services.market_inputs import combine_market_history
from app.services.star_valuation import recalculate_model_values, sync_external_market_inputs
from scripts.backfill_star_valuations import apply_metrics_to_star, apply_ranked_renderer_positions, select_balanced_candidates


engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

TARGET_COUNT = 500
MIN_DISTANCE_PC = 1000.0 / 3.26156
MAX_DISTANCE_PC = 100000.0 / 3.26156
DISTANCE_BINS_PC = [
    MIN_DISTANCE_PC,
    1000.0,
    2000.0,
    4000.0,
    7000.0,
    10000.0,
    15000.0,
    22000.0,
    MAX_DISTANCE_PC,
]
TOP_PER_BIN = 1800

REPORT_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "app",
    "data",
    "blue_gaia_import_report.json",
)


def build_blue_query(lo_pc: float, hi_pc: float, top: int) -> str:
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
    0.0 AS classprob_dsc_combmod_binarystar,
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
  AND ap.distance_gspphot IS NOT NULL
  AND ap.distance_gspphot >= {lo_pc}
  AND ap.distance_gspphot < {hi_pc}
  AND gs.phot_g_mean_mag IS NOT NULL
  AND gs.parallax IS NOT NULL
  AND gs.non_single_star IS NOT NULL
  AND gs.phot_variable_flag IS NOT NULL
  AND ap.lum_flame IS NOT NULL
  AND ap.teff_gspphot IS NOT NULL
  AND ap.mh_gspphot IS NOT NULL
  AND ap.radius_flame IS NOT NULL
  AND ap.age_flame IS NOT NULL
  AND vc.best_class_name IS NOT NULL
  AND (
        ap.teff_gspphot >= 10000
        OR gs.bp_rp <= 0.15
        OR ap.spectraltype_esphs LIKE 'O%%'
        OR ap.spectraltype_esphs LIKE 'B%%'
      )
ORDER BY gs.random_index ASC
""".strip()


def make_star_from_candidate(candidate) -> Star:
    canonical_id = f"GAIA DR3 {candidate.source_id}"
    star = Star(
        scientific_name=canonical_id,
        common_name=None,
        catalog_id=canonical_id,
        canonical_id=canonical_id,
        identifier_type="gaia_source_id",
        source_catalog="Gaia DR3",
        source_id=candidate.source_id,
        display_name=canonical_id,
        category=candidate.category,
        x=candidate.x,
        y=candidate.y,
        z=candidate.z,
        distance_ly=candidate.distance_ly,
        hyg_id=None,
        hip=None,
        hd=None,
        hr=None,
        gl=None,
        bf=None,
        bayer=None,
        flamsteed=None,
        constellation=candidate.constellation,
        spectral_type=candidate.spectral_type,
        ra_degrees=candidate.ra_degrees,
        ra_hours=candidate.ra_degrees / 15.0,
        dec_degrees=candidate.dec_degrees,
        distance_parsecs=candidate.distance_parsecs,
        galactic_longitude_deg=candidate.galactic_longitude_deg,
        galactic_latitude_deg=candidate.galactic_latitude_deg,
        x_pc=candidate.x_pc,
        y_pc=candidate.y_pc,
        z_pc=candidate.z_pc,
        apparent_magnitude=candidate.phot_g_mean_mag,
        absolute_magnitude=candidate.absolute_magnitude,
        luminosity=candidate.luminosity,
        color_index=candidate.color_index,
        radial_velocity=candidate.radial_velocity,
        pm=candidate.pm,
        pmra=candidate.pmra,
        pmdec=candidate.pmdec,
        price=settings.STAR_ISSUE_PRICE,
        issue_price=settings.STAR_ISSUE_PRICE,
        is_bought=False,
    )
    apply_metrics_to_star(star, candidate)
    return star


async def main() -> None:
    async with AsyncSessionLocal() as db:
        stars_result = await db.execute(select(Star))
        existing_stars = list(stars_result.scalars().all())
        used_source_ids = {
            str(star.gaia_source_id or star.source_id or "").strip()
            for star in existing_stars
            if str(star.gaia_source_id or star.source_id or "").strip()
        }

        report: dict[str, object] = {
            "target_count": TARGET_COUNT,
            "distance_range_ly": [1000, 100000],
            "distance_bins_pc": [round(value, 3) for value in DISTANCE_BINS_PC],
            "existing_star_count": len(existing_stars),
        }

        pool = []
        pool_counts = {}
        seen_source_ids = set()
        for lo_pc, hi_pc in zip(DISTANCE_BINS_PC[:-1], DISTANCE_BINS_PC[1:]):
            label = radial_bin_label(lo_pc, hi_pc)
            rows = tap_query_rows(build_blue_query(lo_pc, hi_pc, TOP_PER_BIN))
            added = 0
            for row in rows:
                candidate = row_to_valuation_candidate(row)
                if candidate is None:
                    continue
                if candidate.source_id in seen_source_ids or candidate.source_id in used_source_ids:
                    continue
                if not candidate.category.startswith("Blue"):
                    continue
                seen_source_ids.add(candidate.source_id)
                pool.append(candidate)
                added += 1
            pool_counts[label] = added

        report["pool_counts_by_distance_bin"] = pool_counts
        report["pool_size"] = len(pool)

        if len(pool) < TARGET_COUNT:
            raise RuntimeError(f"Only found {len(pool)} eligible unused blue Gaia candidates; needed {TARGET_COUNT}.")

        selected, diagnostics = select_balanced_candidates(pool, TARGET_COUNT, DISTANCE_BINS_PC)
        apply_ranked_renderer_positions(selected)
        report["selection"] = diagnostics
        report["selected_count"] = len(selected)

        if len(selected) < TARGET_COUNT:
            raise RuntimeError(f"Only selected {len(selected)} blue Gaia stars after balancing; needed {TARGET_COUNT}.")

        new_stars = [make_star_from_candidate(candidate) for candidate in selected]
        db.add_all(new_stars)
        await db.flush()

        snapshots = combine_market_history(max_points=settings.STAR_VALUATION_MARKET_LOOKBACK_DAYS)
        if snapshots:
            await sync_external_market_inputs(db, snapshots[-settings.STAR_VALUATION_HISTORY_BOOTSTRAP_DAYS :])
        valuation_summary = await recalculate_model_values(db)
        await db.commit()

        categories = Counter(star.category for star in new_stars)
        report["added_star_count"] = len(new_stars)
        report["new_total_star_count"] = len(existing_stars) + len(new_stars)
        report["category_breakdown"] = dict(categories)
        report["valuation_summary"] = valuation_summary

        with open(REPORT_PATH, "w", encoding="utf-8") as report_file:
            json.dump(report, report_file, indent=2)

        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
