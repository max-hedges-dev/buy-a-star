from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.db.base_class import Base


class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True, index=True)
    star_id = Column(Integer, ForeignKey("stars.id"), nullable=False, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True, unique=True, index=True)
    registration_number = Column(String, nullable=False, unique=True, index=True)
    status = Column(String, nullable=False, default="registered_self", index=True)
    purchaser_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    current_holder_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    recipient_name = Column(String, nullable=True)
    recipient_email = Column(String, nullable=True)
    registered_display_name = Column(String, nullable=False)
    dedication = Column(Text, nullable=True)
    gift_message = Column(Text, nullable=True)
    is_gift = Column(Boolean, nullable=False, default=False)
    is_demo = Column(Boolean, nullable=False, default=False)
    claim_status = Column(String, nullable=False, default="not_claimable", index=True)
    claim_token_hash = Column(String, nullable=True, unique=True, index=True)
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    public_page_slug = Column(String, nullable=False, unique=True, index=True)
    public_page_visibility = Column(String, nullable=False, default="public")
    ownership_history_visibility = Column(String, nullable=False, default="private")
    certificate_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
