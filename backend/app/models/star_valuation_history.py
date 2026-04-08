from sqlalchemy import Column, Integer, Numeric, Date, DateTime, ForeignKey, Float, UniqueConstraint
from sqlalchemy.sql import func

from app.db.base_class import Base


class StarValuationHistory(Base):
    __tablename__ = "star_valuation_history"
    __table_args__ = (
        UniqueConstraint("star_id", "valuation_date", name="uq_star_valuation_history_star_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    star_id = Column(Integer, ForeignKey("stars.id"), nullable=False, index=True)
    valuation_date = Column(Date, nullable=False, index=True)
    issue_price = Column(Numeric(10, 2), nullable=False)
    model_value = Column(Numeric(10, 2), nullable=False)
    energy_price = Column(Numeric(18, 6), nullable=True)
    metals_price = Column(Numeric(18, 6), nullable=True)
    energy_change_ratio = Column(Float, nullable=True)
    metals_change_ratio = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
