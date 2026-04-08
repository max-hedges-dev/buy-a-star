"""add stripe checkout fields to transactions

Revision ID: e8b1f4c2d6a9
Revises: d4e5f6a7b8c9
Create Date: 2026-03-29 20:15:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e8b1f4c2d6a9"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column("transactions", sa.Column("owner_name", sa.String(), nullable=True))
    op.add_column("transactions", sa.Column("currency", sa.String(length=3), nullable=False, server_default="gbp"))
    op.add_column("transactions", sa.Column("status", sa.String(), nullable=False, server_default="pending"))
    op.add_column("transactions", sa.Column("stripe_checkout_session_id", sa.String(), nullable=True))
    op.add_column("transactions", sa.Column("stripe_payment_intent_id", sa.String(), nullable=True))
    op.add_column("transactions", sa.Column("accepted_terms_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("transactions", sa.Column("accepted_privacy_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("transactions", sa.Column("fulfilled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("transactions", sa.Column("checkout_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "transactions",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index(
        op.f("ix_transactions_stripe_checkout_session_id"),
        "transactions",
        ["stripe_checkout_session_id"],
        unique=True,
    )
    op.create_foreign_key(
        "fk_transactions_user_id_users",
        "transactions",
        "users",
        ["user_id"],
        ["id"],
    )

    op.alter_column("transactions", "currency", server_default=None)
    op.alter_column("transactions", "status", server_default=None)


def downgrade() -> None:
    op.drop_constraint("fk_transactions_user_id_users", "transactions", type_="foreignkey")
    op.drop_index(op.f("ix_transactions_stripe_checkout_session_id"), table_name="transactions")
    op.drop_column("transactions", "updated_at")
    op.drop_column("transactions", "checkout_expires_at")
    op.drop_column("transactions", "fulfilled_at")
    op.drop_column("transactions", "accepted_privacy_at")
    op.drop_column("transactions", "accepted_terms_at")
    op.drop_column("transactions", "stripe_payment_intent_id")
    op.drop_column("transactions", "stripe_checkout_session_id")
    op.drop_column("transactions", "status")
    op.drop_column("transactions", "currency")
    op.drop_column("transactions", "owner_name")
    op.drop_column("transactions", "user_id")
