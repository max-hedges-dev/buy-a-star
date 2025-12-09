import asyncio
import random
import sys
import os
import math

# Add parent dir to path to import app
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
from app.core.config import settings
from app.models.star import Star

from app.models.transaction import Transaction

# Create async session manually as we are in a script
engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

CATALOG_PREFIXES = ["HIP", "HD", "SAO", "TYC"]

def generate_star_name():
    return f"{random.choice(CATALOG_PREFIXES)}-{random.randint(1000, 9999)}-{random.randint(10, 99)}"

async def seed():
    print("Seeding database...")
    async with AsyncSessionLocal() as session:
        # Clear existing stars to re-seed with new coordinates
        print("Clearing existing data...")
        await session.execute(delete(Transaction))
        await session.execute(delete(Star))
        
        stars = []
        
        # Spiral Galaxy Parameters
        # 3 arms
        arms = 3
        arm_separation_distance = 2 * math.pi / arms
        
        print("Generating spiral galaxy coordinates...")
        
        for i in range(1000):
            scientific_name = generate_star_name()
            
            # Spiral distribution
            # Distance from center (0 to 1200 ly radius)
            # Use a distribution that puts more stars in the center but spreads them out
            r_norm = random.random()
            r_norm = 1 - r_norm * r_norm # Bias towards center? No, let's keep it simple.
            distance = random.uniform(50, 1000) 
            
            # Angle based on distance + arm offset
            spin = 5.0 # How tight the spiral is
            
            # Determine which arm
            arm_index = i % arms
            arm_angle = arm_index * arm_separation_distance
            
            # Angle increases with distance
            angle = (distance / 1000.0) * spin + arm_angle
            
            # Add randomness/scatter to the arm width
            random_offset = random.normalvariate(0, 0.5) 
            angle += random_offset
            
            x = math.cos(angle) * distance
            z = math.sin(angle) * distance
            
            # Y is the thickness of the disk
            # Thicker at center
            thickness_at_dist = 100 * (1 - (distance/1200))
            if thickness_at_dist < 20: thickness_at_dist = 20
            
            y = random.normalvariate(0, thickness_at_dist)
            
            # Determine category based on rarity
            rand_val = random.random()
            if rand_val < 0.05:
                category = "Blue Giant"
            elif rand_val < 0.15:
                category = "Red Giant"
            elif rand_val < 0.30:
                category = "White Dwarf"
            elif rand_val < 0.60:
                category = "Yellow Dwarf" # Like Sun
            else:
                category = "Red Dwarf"
                
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
