from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String
from sqlalchemy.sql import func

from app.db.base_class import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_sub = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    email_verified = Column(Boolean, nullable=False, default=False)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    connected_account_id = Column(String, unique=True, index=True, nullable=True)
    stripe_seller_onboarding_status = Column(String, nullable=False, default="not_started")
    stripe_seller_charges_enabled = Column(Boolean, nullable=False, default=False)
    stripe_seller_payouts_enabled = Column(Boolean, nullable=False, default=False)
    stripe_seller_details_submitted = Column(Boolean, nullable=False, default=False)
    stripe_seller_requirements_due = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    last_login_at = Column(DateTime(timezone=True), nullable=True)
