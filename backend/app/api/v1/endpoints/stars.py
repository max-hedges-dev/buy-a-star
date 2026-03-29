from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.db.session import get_db
from app.models.star import Star

router = APIRouter()

@router.get("")
@router.get("/")
async def read_stars(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    is_bought: Optional[bool] = None
):
    query = select(Star)
    if search:
        query = query.filter(Star.common_name.ilike(f"%{search}%") | Star.scientific_name.ilike(f"%{search}%"))
    if is_bought is not None:
        query = query.filter(Star.is_bought == is_bought)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    stars = result.scalars().all()
    return stars

@router.get("/{star_id}")
async def read_star(star_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Star).filter(Star.id == star_id))
    star = result.scalars().first()
    return star
