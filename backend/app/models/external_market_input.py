from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, Float, JSON, UniqueConstraint
from sqlalchemy.sql import func

from app.db.base_class import Base


class ExternalMarketInput(Base):
    __tablename__ = "external_market_inputs"
    __table_args__ = (
        UniqueConstraint("provider", "market_date", name="uq_external_market_inputs_provider_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, nullable=False, index=True)
    market_date = Column(Date, nullable=False, index=True)
    energy_symbol = Column(String, nullable=False)
    metals_symbol = Column(String, nullable=False)
    energy_price = Column(Numeric(18, 6), nullable=False)
    metals_price = Column(Numeric(18, 6), nullable=False)
    energy_change_ratio = Column(Float, nullable=True)
    metals_change_ratio = Column(Float, nullable=True)
    raw_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
