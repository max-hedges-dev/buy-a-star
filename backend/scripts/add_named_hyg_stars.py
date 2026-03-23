#!/usr/bin/env python3
"""
Append famous / named HYG stars onto the existing Gaia-based dataset and DB.

This script is intentionally additive:
- it does not remove any existing stars,
- it appends all HYG rows with a proper name,
- it also appends bright HD stars (mag <= 6.5) as a recognizable supplement,
- it skips anything already present,
- it restores Sol as owned by Max Hedges.
"""
import asyncio
import json
import os
import sys
from datetime import datetime, timezone

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.star import Star
from generate_galaxy_stars import (
    HYG_CSV_PATH,
    OUTPUT_PATH,
    Candidate,
    derive_star_class_label,
    derive_constellation,
    heliocentric_galactic_xyz,
    hyg_row_to_candidate,
    parse_float,
    transformed_renderer_position,
)
import csv


engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def load_existing_json():
    with open(OUTPUT_PATH, "r", encoding="utf-8") as handle:
        raw = json.load(handle)

    seen_ids = set()
    seen_names = set()
    deduped = []
    for item in raw:
        canonical_id = item.get("canonical_id")
        scientific_name = item.get("scientific_name")
        if canonical_id in seen_ids or scientific_name in seen_names:
            continue
        seen_ids.add(canonical_id)
        seen_names.add(scientific_name)
        deduped.append(item)
    return deduped


def write_json(payload):
    with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def make_hd_candidate(row):
    hd = (row.get("hd") or "").strip()
    if not hd:
        return None

    base = hyg_row_to_candidate(row)
    if base is None:
        return None

    proper_name = (row.get("proper") or "").strip() or None
    return Candidate(
        canonical_id=f"HD {hd}",
        identifier_type="hd",
        source_catalog="HYG v4.1",
        source_id=f"HD-{hd}",
        display_name=proper_name or f"HD {hd}",
        scientific_name=proper_name or f"HD {hd}",
        category=derive_star_class_label(base.spectral_type),
        distance_pc=base.distance_pc,
        distance_ly=base.distance_ly,
        spectral_type=base.spectral_type,
        apparent_mag=base.apparent_mag,
        absolute_mag=base.absolute_mag,
        luminosity_lsol=base.luminosity_lsol,
        color_index=base.color_index,
        constellation=base.constellation,
        ra_deg=base.ra_deg,
        ra_hours=base.ra_hours,
        dec_deg=base.dec_deg,
        galactic_l_deg=base.galactic_l_deg,
        galactic_b_deg=base.galactic_b_deg,
        x_pc=base.x_pc,
        y_pc=base.y_pc,
        z_pc=base.z_pc,
        random_index=base.random_index,
        star_probability=1.0,
        price=100.0 if proper_name else 12.99,
    )


def sol_candidate():
    return Candidate(
        canonical_id="SOL",
        identifier_type="solar_system",
        source_catalog="Solar System",
        source_id="SOL",
        display_name="Sol",
        scientific_name="Sol",
        category="Yellow Dwarf",
        distance_pc=0.0,
        distance_ly=0.0,
        spectral_type="G2V",
        apparent_mag=-26.74,
        absolute_mag=4.83,
        luminosity_lsol=1.0,
        color_index=0.656,
        constellation="Sol",
        ra_deg=0.0,
        ra_hours=0.0,
        dec_deg=0.0,
        galactic_l_deg=0.0,
        galactic_b_deg=0.0,
        x_pc=0.0,
        y_pc=0.0,
        z_pc=0.0,
        random_index=-1,
        star_probability=1.0,
        price=100.0,
    )


def candidate_to_payload(candidate, max_distance_pc):
    normalized = 0.0 if max_distance_pc <= 0 else min(1.0, max(candidate.distance_pc, 0.0) / max_distance_pc)
    x, y, z = transformed_renderer_position(candidate.galactic_l_deg, candidate.galactic_b_deg, normalized)
    return {
        "id": candidate.canonical_id,
        "catalog_id": candidate.canonical_id,
        "canonical_id": candidate.canonical_id,
        "identifier_type": candidate.identifier_type,
        "source_catalog": candidate.source_catalog,
        "source_id": candidate.source_id,
        "display_name": candidate.display_name,
        "scientific_name": candidate.scientific_name,
        "common_name": candidate.display_name if candidate.source_catalog != "Gaia DR3" else None,
        "category": candidate.category,
        "distance_pc": round(candidate.distance_pc, 6),
        "distance_parsecs": round(candidate.distance_pc, 6),
        "distance_ly": round(candidate.distance_ly, 2),
        "spectral_type": candidate.spectral_type,
        "star_class_label": candidate.category,
        "apparent_mag": round(candidate.apparent_mag, 6),
        "apparent_magnitude": round(candidate.apparent_mag, 6),
        "absolute_mag": round(candidate.absolute_mag, 6),
        "absolute_magnitude": round(candidate.absolute_mag, 6),
        "luminosity_lsol": round(candidate.luminosity_lsol, 6),
        "luminosity": round(candidate.luminosity_lsol, 6),
        "color_index": round(candidate.color_index, 6),
        "constellation": candidate.constellation,
        "ra_deg": round(candidate.ra_deg, 6),
        "ra_degrees": round(candidate.ra_deg, 6),
        "ra_hours": round(candidate.ra_hours, 6),
        "dec_deg": round(candidate.dec_deg, 6),
        "dec_degrees": round(candidate.dec_deg, 6),
        "galactic_l_deg": round(candidate.galactic_l_deg, 6),
        "galactic_longitude_deg": round(candidate.galactic_l_deg, 6),
        "galactic_b_deg": round(candidate.galactic_b_deg, 6),
        "galactic_latitude_deg": round(candidate.galactic_b_deg, 6),
        "x_pc": round(candidate.x_pc, 6),
        "y_pc": round(candidate.y_pc, 6),
        "z_pc": round(candidate.z_pc, 6),
        "x": x,
        "y": y,
        "z": z,
        "price": candidate.price,
    }


def build_append_candidates(existing_payload):
    existing_ids = {item.get("canonical_id") for item in existing_payload}
    existing_names = {item.get("scientific_name") for item in existing_payload}
    supplements = [sol_candidate()]
    seen_ids = {supplements[0].canonical_id}
    seen_names = {supplements[0].scientific_name}

    with open(HYG_CSV_PATH, "r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            proper_name = (row.get("proper") or "").strip()
            if not proper_name:
                continue
            candidate = hyg_row_to_candidate(row)
            if (
                candidate is None
                or candidate.canonical_id in seen_ids
                or candidate.scientific_name in seen_names
            ):
                continue
            supplements.append(candidate)
            seen_ids.add(candidate.canonical_id)
            seen_names.add(candidate.scientific_name)

    with open(HYG_CSV_PATH, "r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            proper_name = (row.get("proper") or "").strip()
            if proper_name:
                continue
            mag = parse_float(row.get("mag"))
            if mag is None or mag > 6.5:
                continue
            candidate = make_hd_candidate(row)
            if (
                candidate is None
                or candidate.canonical_id in seen_ids
                or candidate.scientific_name in seen_names
            ):
                continue
            supplements.append(candidate)
            seen_ids.add(candidate.canonical_id)
            seen_names.add(candidate.scientific_name)

    additions = [
        candidate
        for candidate in supplements
        if candidate.canonical_id not in existing_ids and candidate.scientific_name not in existing_names
    ]
    return additions


def star_from_payload(payload):
    return Star(
        scientific_name=payload["scientific_name"],
        common_name=payload.get("common_name"),
        catalog_id=str(payload.get("catalog_id") or payload.get("canonical_id") or payload.get("id", "")),
        canonical_id=payload.get("canonical_id"),
        identifier_type=payload.get("identifier_type"),
        source_catalog=payload.get("source_catalog"),
        source_id=str(payload.get("source_id")) if payload.get("source_id") is not None else None,
        display_name=payload.get("display_name"),
        category=payload["category"],
        x=payload["x"],
        y=payload["y"],
        z=payload["z"],
        distance_ly=payload.get("distance_ly", 0),
        constellation=payload.get("constellation"),
        spectral_type=payload.get("spectral_type"),
        ra_degrees=payload.get("ra_degrees") or payload.get("ra_deg"),
        ra_hours=payload.get("ra_hours"),
        dec_degrees=payload.get("dec_degrees") or payload.get("dec_deg"),
        distance_parsecs=payload.get("distance_parsecs") or payload.get("distance_pc"),
        galactic_longitude_deg=payload.get("galactic_longitude_deg") or payload.get("galactic_l_deg"),
        galactic_latitude_deg=payload.get("galactic_latitude_deg") or payload.get("galactic_b_deg"),
        x_pc=payload.get("x_pc"),
        y_pc=payload.get("y_pc"),
        z_pc=payload.get("z_pc"),
        apparent_magnitude=payload.get("apparent_magnitude") or payload.get("apparent_mag"),
        absolute_magnitude=payload.get("absolute_magnitude") or payload.get("absolute_mag"),
        luminosity=payload.get("luminosity") or payload.get("luminosity_lsol"),
        color_index=payload.get("color_index"),
        price=payload.get("price", 12.99),
        is_bought=False,
    )


async def append_to_database(full_payload):
    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(Star.canonical_id, Star.scientific_name))
        existing_rows = existing.all()
        existing_ids = {row[0] for row in existing_rows}
        existing_names = {row[1] for row in existing_rows}

        to_add = [
            star_from_payload(item)
            for item in full_payload
            if item["canonical_id"] not in existing_ids and item["scientific_name"] not in existing_names
        ]
        if to_add:
            session.add_all(to_add)

        await session.flush()

        sol_result = await session.execute(select(Star).where(Star.canonical_id == "SOL"))
        sol = sol_result.scalar_one_or_none()
        if sol is None:
            for star in to_add:
                if star.canonical_id == "SOL":
                    sol = star
                    break
        if sol is not None:
            sol.is_bought = True
            sol.owner_name = "Max Hedges"
            sol.purchase_date = datetime.now(timezone.utc)

        await session.commit()
        return len(to_add)


async def main():
    existing_payload = load_existing_json()
    additions = build_append_candidates(existing_payload)
    max_distance_pc = max(
        [item.get("distance_pc") or item.get("distance_parsecs") or 0 for item in existing_payload]
        + [candidate.distance_pc for candidate in additions]
    )
    addition_payload = [candidate_to_payload(candidate, max_distance_pc) for candidate in additions]
    merged_payload = existing_payload + addition_payload
    write_json(merged_payload)
    inserted_count = await append_to_database(merged_payload)
    print(f"Existing stars kept: {len(existing_payload)}")
    print(f"New stars appended to JSON: {len(addition_payload)}")
    print(f"New stars inserted into DB: {inserted_count}")
    print(f"New total JSON count: {len(merged_payload)}")
    print("Sol ownership restored to Max Hedges")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
