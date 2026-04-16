from sqlalchemy import Column, Integer, Boolean, Numeric, ForeignKey, DateTime, String, JSON
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
    certificate_type = Column(String, nullable=False, default="digital")
    shipping_required = Column(Boolean, nullable=False, default=False)
    shipping_amount = Column(Numeric(10, 2), nullable=False, default=0)
    shipping_rate_id = Column(String, nullable=True)
    shipping_name = Column(String, nullable=True)
    shipping_phone = Column(String, nullable=True)
    shipping_address = Column(JSON, nullable=True)
    transaction_type = Column(String, nullable=False, default="primary")
    status = Column(String, nullable=False, default="pending")
    registration_number = Column(String, unique=True, index=True, nullable=True)
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
