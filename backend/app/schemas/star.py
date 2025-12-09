from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class StarBase(BaseModel):
    scientific_name: str
    common_name: Optional[str] = None
    category: str
    price: float
    distance_ly: float
    is_bought: bool = False
    owner_name: Optional[str] = None

class StarCreate(StarBase):
    pass

class StarRead(StarBase):
    id: int
    x: float
    y: float
    z: float
    purchase_date: Optional[datetime] = None

    class Config:
        from_attributes = True

class StarPurchaseRequest(BaseModel):
    owner_name: str
    payment_method: str = "paypal"
    include_certificate: bool = True
