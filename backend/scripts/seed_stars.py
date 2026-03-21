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
                catalog_id=str(s.get('id', '')),
                category=s['category'],
                x=s['x'],
                y=s['y'],
                z=s['z'],
                distance_ly=s.get('distance_ly', 0),
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
