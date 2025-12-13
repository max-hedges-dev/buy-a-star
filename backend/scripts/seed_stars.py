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

# Galaxy parameters (match frontend v2)
RADIUS = 1500           # Smaller
ARMS = 4
SPIN = 0.7              # Looser spirals
BULGE_RADIUS_X = 250    # Narrower
BULGE_RADIUS_Z = 100

def generate_star_name():
    return f"{random.choice(CATALOG_PREFIXES)}-{random.randint(1000, 9999)}-{random.randint(10, 99)}"

def get_spiral_position(arm_index, t, scatter=80):
    """Generate position on spiral arm"""
    r = BULGE_RADIUS_X + t * (RADIUS - BULGE_RADIUS_X)
    
    arm_offset = (arm_index / ARMS) * math.pi * 2
    spiral_angle = arm_offset + t * SPIN * math.pi * 2
    
    x = math.cos(spiral_angle) * r
    z = math.sin(spiral_angle) * r
    
    if scatter > 0:
        scatter_angle = random.random() * math.pi * 2
        scatter_dist = math.pow(random.random(), 0.7) * scatter
        x += math.cos(scatter_angle) * scatter_dist
        z += math.sin(scatter_angle) * scatter_dist
    
    y_thickness = 50 * (1 - t * 0.7)
    y = (random.random() - 0.5) * y_thickness
    
    return x, y, z

def get_bulge_position():
    """Generate position in central bulge"""
    theta = random.random() * math.pi * 2
    r = math.pow(random.random(), 0.5)
    
    x = math.cos(theta) * r * BULGE_RADIUS_X
    z = math.sin(theta) * r * BULGE_RADIUS_Z
    y = (random.random() - 0.5) * BULGE_RADIUS_Z * 0.4
    
    return x, y, z

async def seed():
    print("Seeding database with looser 4-arm Milky Way structure...")
    async with AsyncSessionLocal() as session:
        print("Clearing existing data...")
        await session.execute(delete(Transaction))
        await session.execute(delete(Star))
        
        stars = []
        COUNT = 1000
        
        for i in range(COUNT):
            scientific_name = generate_star_name()
            in_bulge = random.random() < 0.15
            
            if in_bulge:
                x, y, z = get_bulge_position()
                rv = random.random()
                if rv < 0.5:
                    category = "Yellow Dwarf"
                elif rv < 0.85:
                    category = "Red Giant"
                else:
                    category = "Red Dwarf"
            else:
                arm_index = i % ARMS
                t = math.pow(random.random(), 0.7)
                x, y, z = get_spiral_position(arm_index, t, scatter=80)
                
                rv = random.random()
                if rv < 0.6:
                    category = "Blue Giant"
                elif rv < 0.85:
                    category = "White Dwarf"
                else:
                    category = "Yellow Dwarf"

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
