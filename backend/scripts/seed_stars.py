import asyncio
import sys
import os
import json

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import delete
from app.core.config import settings
from app.models.star import Star
from app.models.transaction import Transaction

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def seed():
    print("Seeding database with galaxy stars...")
    async with AsyncSessionLocal() as session:
        print("Clearing existing data...")
        await session.execute(delete(Transaction))
        await session.execute(delete(Star))

        # Load stars from JSON (positions are pre-computed model coordinates)
        json_path = os.path.join(os.path.dirname(__file__), "../app/data/stars.json")
        try:
            with open(json_path, 'r') as f:
                stars_data = json.load(f)
        except FileNotFoundError:
            print(f"Error: {json_path} not found. Run generate_galaxy_stars.py first.")
            sys.exit(1)

        print(f"Loading {len(stars_data)} stars...")

        stars_to_add = []
        for s in stars_data:
            stars_to_add.append(Star(
                scientific_name=s['scientific_name'],
                common_name=s.get('common_name'),
                catalog_id=str(s.get('catalog_id') or s.get('canonical_id') or s.get('id', '')),
                canonical_id=s.get('canonical_id'),
                identifier_type=s.get('identifier_type'),
                source_catalog=s.get('source_catalog'),
                source_id=str(s.get('source_id')) if s.get('source_id') is not None else None,
                display_name=s.get('display_name'),
                category=s['category'],
                x=s['x'],
                y=s['y'],
                z=s['z'],
                distance_ly=s.get('distance_ly', 0),
                hyg_id=s.get('hyg_id'),
                hip=s.get('hip'),
                hd=s.get('hd'),
                hr=s.get('hr'),
                gl=s.get('gl'),
                bf=s.get('bf'),
                bayer=s.get('bayer'),
                flamsteed=s.get('flamsteed'),
                constellation=s.get('constellation'),
                spectral_type=s.get('spectral_type'),
                ra_degrees=s.get('ra_degrees') or s.get('ra_deg'),
                ra_hours=s.get('ra_hours'),
                dec_degrees=s.get('dec_degrees') or s.get('dec_deg'),
                distance_parsecs=s.get('distance_parsecs') or s.get('distance_pc'),
                galactic_longitude_deg=s.get('galactic_longitude_deg') or s.get('galactic_l_deg'),
                galactic_latitude_deg=s.get('galactic_latitude_deg') or s.get('galactic_b_deg'),
                x_pc=s.get('x_pc'),
                y_pc=s.get('y_pc'),
                z_pc=s.get('z_pc'),
                apparent_magnitude=s.get('apparent_magnitude') or s.get('apparent_mag'),
                absolute_magnitude=s.get('absolute_magnitude') or s.get('absolute_mag'),
                luminosity=s.get('luminosity') or s.get('luminosity_lsol'),
                color_index=s.get('color_index'),
                radial_velocity=s.get('radial_velocity'),
                pmra=s.get('pmra'),
                pmdec=s.get('pmdec'),
                variable_designation=s.get('variable_designation'),
                variable_min=s.get('variable_min'),
                variable_max=s.get('variable_max'),
                price=s.get('price', 12.99),
                is_bought=False
            ))

        session.add_all(stars_to_add)
        try:
            await session.commit()
            print(f"Successfully seeded {len(stars_to_add)} stars.")
        except Exception as e:
            print(f"Error seeding data: {e}")
            await session.rollback()
            raise e

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed())
