from sqlalchemy import Column, Integer, String, Float, Boolean, Numeric, DateTime
from app.db.base_class import Base

class Star(Base):
    __tablename__ = "stars"

    id = Column(Integer, primary_key=True, index=True)
    scientific_name = Column(String, unique=True, index=True, nullable=False)
    common_name = Column(String, index=True, nullable=True)
    catalog_id = Column(String, index=True, nullable=True)
    canonical_id = Column(String, index=True, nullable=True)
    identifier_type = Column(String, nullable=True)
    source_catalog = Column(String, nullable=True)
    source_id = Column(String, index=True, nullable=True)
    display_name = Column(String, nullable=True)
    category = Column(String, nullable=False) # e.g. "Blue Giant"
    
    # 3D Coordinates (light years from 0,0,0 which is Earth/Sun)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    z = Column(Float, nullable=False)
    
    distance_ly = Column(Float, nullable=False)

    # HYG enrichment fields
    hyg_id = Column(Integer, nullable=True)
    hip = Column(Integer, nullable=True)
    hd = Column(Integer, nullable=True)
    hr = Column(Integer, nullable=True)
    gl = Column(String, nullable=True)
    bf = Column(String, nullable=True)
    bayer = Column(String, nullable=True)
    flamsteed = Column(Integer, nullable=True)
    constellation = Column(String, nullable=True)
    spectral_type = Column(String, nullable=True)
    ra_degrees = Column(Float, nullable=True)
    ra_hours = Column(Float, nullable=True)
    dec_degrees = Column(Float, nullable=True)
    distance_parsecs = Column(Float, nullable=True)
    galactic_longitude_deg = Column(Float, nullable=True)
    galactic_latitude_deg = Column(Float, nullable=True)
    x_pc = Column(Float, nullable=True)
    y_pc = Column(Float, nullable=True)
    z_pc = Column(Float, nullable=True)
    apparent_magnitude = Column(Float, nullable=True)
    absolute_magnitude = Column(Float, nullable=True)
    luminosity = Column(Float, nullable=True)
    color_index = Column(Float, nullable=True)
    radial_velocity = Column(Float, nullable=True)
    pmra = Column(Float, nullable=True)
    pmdec = Column(Float, nullable=True)
    variable_designation = Column(String, nullable=True)
    variable_min = Column(Float, nullable=True)
    variable_max = Column(Float, nullable=True)
    
    price = Column(Numeric(10, 2), default=12.99)
    is_bought = Column(Boolean, default=False)
    owner_name = Column(String, nullable=True)
    purchase_date = Column(DateTime(timezone=True), nullable=True)
