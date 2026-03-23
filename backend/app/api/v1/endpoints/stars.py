from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime
from app.db.session import get_db
from app.models.star import Star
# from app.schemas.star import StarRead, StarCreate # We'll create schemas later

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

from app.schemas.star import StarPurchaseRequest, StarRead
from app.models.transaction import Transaction

@router.post("/{star_id}/buy", response_model=StarRead)
async def buy_star(
    star_id: int, 
    purchase_req: StarPurchaseRequest,
    db: AsyncSession = Depends(get_db)
):
    # Start transaction with lock
    async with db.begin():
        # Select for update to lock the row
        result = await db.execute(select(Star).filter(Star.id == star_id).with_for_update())
        star = result.scalars().first()
        
        if not star:
            raise HTTPException(status_code=404, detail="Star not found")
            
        if star.is_bought:
            raise HTTPException(status_code=400, detail="Star is already owned by someone else")
            
        # Process purchase
        star.is_bought = True
        star.owner_name = purchase_req.owner_name
        star.purchase_date = datetime.utcnow()
        
        # Create transaction record
        amount = float(star.price)
        if purchase_req.include_certificate:
            amount += 5.00
            
        transaction = Transaction(
            star_id=star.id,
            amount=amount,
            includes_certificate=purchase_req.include_certificate
        )
        db.add(transaction)
        
        await db.commit()
        await db.refresh(star)
        
    return star
