#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.star import Star
from app.services.gaia_valuation import derive_star_class_label


engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Star).where(Star.source_catalog == "Gaia DR3"))
        stars = result.scalars().all()
        updated = 0
        for star in stars:
            new_category = derive_star_class_label(
                star.spectral_type or "",
                teff_gspphot=star.teff_gspphot,
                bp_rp=star.bp_rp if star.bp_rp is not None else star.color_index,
                radius_flame=star.radius_flame,
                lum_flame=star.lum_flame if star.lum_flame is not None else star.luminosity,
                absolute_magnitude=star.absolute_magnitude,
                evolstage_flame=star.evolstage_flame,
                mass_flame=star.mass_flame,
            )
            if new_category != star.category:
                star.category = new_category
                updated += 1
        await db.commit()
        print(f"Updated {updated} Gaia DR3 star categories out of {len(stars)}")


if __name__ == "__main__":
    asyncio.run(main())
