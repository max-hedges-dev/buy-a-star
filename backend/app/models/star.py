from sqlalchemy import Column, Integer, String, Float, Boolean, Numeric, DateTime
from app.db.base_class import Base

class Star(Base):
    __tablename__ = "stars"

    id = Column(Integer, primary_key=True, index=True)
    scientific_name = Column(String, unique=True, index=True, nullable=False)
    common_name = Column(String, index=True, nullable=True)
    catalog_id = Column(String, index=True, nullable=True)
    category = Column(String, nullable=False) # e.g. "Blue Giant"
    
    # 3D Coordinates (light years from 0,0,0 which is Earth/Sun)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    z = Column(Float, nullable=False)
    
    distance_ly = Column(Float, nullable=False)
    
    price = Column(Numeric(10, 2), default=12.99)
    is_bought = Column(Boolean, default=False)
    owner_name = Column(String, nullable=True)
    purchase_date = Column(DateTime(timezone=True), nullable=True)
