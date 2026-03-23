from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class StarBase(BaseModel):
    scientific_name: str
    common_name: Optional[str] = None
    catalog_id: Optional[str] = None
    canonical_id: Optional[str] = None
    identifier_type: Optional[str] = None
    source_catalog: Optional[str] = None
    source_id: Optional[str] = None
    display_name: Optional[str] = None
    category: str
    price: float
    distance_ly: float
    is_bought: bool = False
    owner_name: Optional[str] = None
    hyg_id: Optional[int] = None
    hip: Optional[int] = None
    hd: Optional[int] = None
    hr: Optional[int] = None
    gl: Optional[str] = None
    bf: Optional[str] = None
    bayer: Optional[str] = None
    flamsteed: Optional[int] = None
    constellation: Optional[str] = None
    spectral_type: Optional[str] = None
    ra_degrees: Optional[float] = None
    ra_hours: Optional[float] = None
    dec_degrees: Optional[float] = None
    distance_parsecs: Optional[float] = None
    galactic_longitude_deg: Optional[float] = None
    galactic_latitude_deg: Optional[float] = None
    x_pc: Optional[float] = None
    y_pc: Optional[float] = None
    z_pc: Optional[float] = None
    apparent_magnitude: Optional[float] = None
    absolute_magnitude: Optional[float] = None
    luminosity: Optional[float] = None
    color_index: Optional[float] = None
    radial_velocity: Optional[float] = None
    pmra: Optional[float] = None
    pmdec: Optional[float] = None
    variable_designation: Optional[str] = None
    variable_min: Optional[float] = None
    variable_max: Optional[float] = None

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
