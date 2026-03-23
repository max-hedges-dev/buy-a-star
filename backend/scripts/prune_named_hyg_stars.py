#!/usr/bin/env python3
"""
Keep only a compact iconic subset of appended named HYG stars.

This leaves:
- Gaia DR3 stars untouched
- Sol untouched
- a short whitelist of highly recognisable named stars
"""
import asyncio
import json
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.star import Star


JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "app", "data", "stars.json")

ICONIC_NAMES = {
    "Sol",
    "Polaris",
    "Sirius",
    "Betelgeuse",
    "Rigel",
    "Vega",
    "Canopus",
    "Arcturus",
    "Capella",
    "Procyon",
    "Altair",
    "Deneb",
    "Antares",
    "Aldebaran",
    "Spica",
    "Regulus",
    "Fomalhaut",
    "Castor",
    "Pollux",
    "Bellatrix",
    "Algol",
    "Achernar",
    "Alnilam",
    "Alnitak",
    "Mintaka",
    "Dubhe",
    "Merak",
    "Alkaid",
    "Mizar",
    "Alioth",
    "Mirfak",
    "Hamal",
    "Mira",
    "Schedar",
    "Markab",
    "Alpheratz",
    "Shaula",
    "Acrux",
    "Gacrux",
    "Mimosa",
    "Hadar",
    "Rigil Kentaurus",
    "Toliman",
    "Agena",
    "Alphard",
    "Alnair",
}


engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def should_remove(payload: dict) -> bool:
    if payload.get("source_catalog") != "HYG v4.1":
        return False
    common_name = payload.get("common_name") or ""
    display_name = payload.get("display_name") or ""
    if not common_name or common_name.startswith("HD "):
        return False
    return common_name not in ICONIC_NAMES and display_name not in ICONIC_NAMES


def clean_json() -> tuple[int, int]:
    with open(JSON_PATH, "r", encoding="utf-8") as handle:
        stars = json.load(handle)

    kept = [star for star in stars if not should_remove(star)]
    removed = len(stars) - len(kept)

    with open(JSON_PATH, "w", encoding="utf-8") as handle:
        json.dump(kept, handle, indent=2)

    return len(kept), removed


async def clean_db() -> int:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            delete(Star).where(
                Star.source_catalog == "HYG v4.1",
                Star.common_name.is_not(None),
                ~Star.common_name.in_(ICONIC_NAMES),
            )
        )
        await session.commit()
        return result.rowcount or 0


async def main():
    kept_count, removed_json = clean_json()
    removed_db = await clean_db()
    print(f"JSON stars kept: {kept_count}")
    print(f"Named HYG stars removed: {removed_json}")
    print(f"DB named HYG stars removed: {removed_db}")
    print(f"Iconic names kept: {len(ICONIC_NAMES)}")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
