from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.sql import func

from app.db.base_class import Base


class ResaleListing(Base):
    __tablename__ = "resale_listings"

    id = Column(Integer, primary_key=True, index=True)
    star_id = Column(Integer, ForeignKey("stars.id"), nullable=False, index=True)
    seller_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    price = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="gbp")
    status = Column(String, nullable=False, default="active")
    version = Column(Integer, nullable=False, default=1)
    stripe_checkout_session_id = Column(String, unique=True, index=True, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    sold_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ResaleSale(Base):
    __tablename__ = "resale_sales"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("resale_listings.id"), nullable=False, index=True)
    star_id = Column(Integer, ForeignKey("stars.id"), nullable=False, index=True)
    seller_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    buyer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="gbp")
    platform_fee_amount = Column(Numeric(10, 2), nullable=False, default=0)
    seller_proceeds_amount = Column(Numeric(10, 2), nullable=False, default=0)
    status = Column(String, nullable=False, default="checkout_created")
    stripe_checkout_session_id = Column(String, unique=True, index=True, nullable=True)
    stripe_payment_intent_id = Column(String, index=True, nullable=True)
    stripe_charge_id = Column(String, nullable=True)
    stripe_transfer_id = Column(String, nullable=True)
    stripe_application_fee_id = Column(String, nullable=True)
    refunded_amount = Column(Numeric(10, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    paid_at = Column(DateTime(timezone=True), nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SellerBalanceLedger(Base):
    __tablename__ = "seller_balance_ledger"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    resale_sale_id = Column(Integer, ForeignKey("resale_sales.id"), nullable=True, index=True)
    entry_type = Column(String, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="gbp")
    status = Column(String, nullable=False, default="pending")
    available_at = Column(DateTime(timezone=True), nullable=True)
    stripe_payout_id = Column(String, index=True, nullable=True)
    stripe_transfer_id = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    entry_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
