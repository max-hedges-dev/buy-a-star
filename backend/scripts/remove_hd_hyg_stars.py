#!/usr/bin/env python3
"""
Remove only the appended generic HD supplement stars from stars.json and the DB.

This keeps:
- the Gaia DR3 base dataset
- Sol
- all properly named HYG stars
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

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def should_remove(payload: dict) -> bool:
    canonical_id = payload.get("canonical_id") or ""
    display_name = payload.get("display_name") or ""
    source_catalog = payload.get("source_catalog") or ""
    scientific_name = payload.get("scientific_name") or ""
    common_name = payload.get("common_name") or ""
    return (
        source_catalog == "HYG v4.1"
        and canonical_id.startswith("HD ")
        and display_name.startswith("HD ")
        and scientific_name.startswith("HD ")
        and common_name.startswith("HD ")
    )


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
                Star.canonical_id.like("HD %"),
                Star.display_name.like("HD %"),
                Star.scientific_name.like("HD %"),
                Star.common_name.like("HD %"),
            )
        )
        await session.commit()
        return result.rowcount or 0


async def main():
    kept_count, removed_json = clean_json()
    removed_db = await clean_db()
    print(f"JSON stars kept: {kept_count}")
    print(f"JSON HD supplement stars removed: {removed_json}")
    print(f"DB HD supplement stars removed: {removed_db}")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
