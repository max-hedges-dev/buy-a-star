from sqlalchemy import Column, Integer, Boolean, Numeric, ForeignKey, DateTime, String
from sqlalchemy.sql import func
from app.db.base_class import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    star_id = Column(Integer, ForeignKey("stars.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner_name = Column(String, nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="gbp")
    includes_certificate = Column(Boolean, default=False)
    status = Column(String, nullable=False, default="pending")
    stripe_checkout_session_id = Column(String, unique=True, index=True, nullable=True)
    stripe_payment_intent_id = Column(String, nullable=True)
    accepted_terms_at = Column(DateTime(timezone=True), nullable=True)
    accepted_privacy_at = Column(DateTime(timezone=True), nullable=True)
    fulfilled_at = Column(DateTime(timezone=True), nullable=True)
    checkout_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
