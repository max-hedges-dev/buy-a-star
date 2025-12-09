import asyncio
import random
import sys
import os
import math

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
from app.core.config import settings
from app.models.star import Star
from app.models.transaction import Transaction

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

CATALOG_PREFIXES = ["HIP", "HD", "SAO", "TYC"]

def generate_star_name():
    return f"{random.choice(CATALOG_PREFIXES)}-{random.randint(1000, 9999)}-{random.randint(10, 99)}"

async def seed():
    print("Seeding database with Tighter & Thicker Spirals...")
    async with AsyncSessionLocal() as session:
        print("Clearing existing data...")
        await session.execute(delete(Transaction))
        await session.execute(delete(Star))
        
        stars = []
        
        # --- PARAMS (MATCH FRONTEND) ---
        COUNT = 1000
        RADIUS = 2000
        CORE_RADIUS_X = 250 
        CORE_RADIUS_Z = 100 
        SPIN = 12       # Tighter
        ARMS = 2 
        RANDOMNESS = 1.2 # Thicker
        
        for i in range(COUNT):
            scientific_name = generate_star_name()
            is_core = random.random() < 0.2
            
            x = 0; y = 0; z = 0
            category = "White Dwarf" 
            
            if is_core:
                # --- DIM OVAL CORE ---
                theta = random.random() * math.pi * 2
                r = math.pow(random.random(), 0.5)
                x = r * math.cos(theta) * CORE_RADIUS_X
                z = r * math.sin(theta) * CORE_RADIUS_Z
                y = (random.random() - 0.5) * (CORE_RADIUS_X * 0.2)
                
                rv = random.random()
                if rv < 0.6: category = "Red Dwarf" 
                elif rv < 0.9: category = "Red Giant"
                else: category = "Yellow Dwarf"
                
            else:
                # --- ARMS ---
                current_radius = CORE_RADIUS_X + random.random() * (RADIUS - CORE_RADIUS_X)
                spin_angle = (current_radius - CORE_RADIUS_X) / (RADIUS - CORE_RADIUS_X) * SPIN
                arm_index = i % ARMS
                arm_angle = arm_index * math.pi
                final_angle = spin_angle + arm_angle
                
                # --- CIRCULAR SCATTER (THICK) ---
                # Match frontend power 1.5
                scatter_radius = math.pow(random.random(), 1.5) * RANDOMNESS * current_radius
                scatter_angle = random.random() * math.pi * 2
                
                rx = math.cos(scatter_angle) * scatter_radius
                rz = math.sin(scatter_angle) * scatter_radius
                
                x = math.cos(final_angle) * current_radius + rx
                z = math.sin(final_angle) * current_radius + rz
                y = (random.random() - 0.5) * (current_radius * 0.2) # Thicker Y
                
                rv = random.random()
                if rv < 0.4: category = "Blue Giant"
                elif rv < 0.8: category = "White Dwarf" 
                else: category = "Yellow Dwarf"

            stars.append(Star(
                scientific_name=scientific_name,
                common_name=f"{scientific_name} (Common)" if random.random() < 0.1 else None,
                category=category,
                x=x,
                y=y,
                z=z,
                distance_ly=math.sqrt(x*x + y*y + z*z),
                price=12.99,
                is_bought=False
            ))
            
        session.add_all(stars)
        await session.commit()
        print(f"Successfully seeded {len(stars)} stars.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed())
