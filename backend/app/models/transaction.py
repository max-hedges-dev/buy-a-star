from sqlalchemy import Column, Integer, Boolean, Numeric, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    star_id = Column(Integer, ForeignKey("stars.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    includes_certificate = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
