"""add certificate type and shipping details to transactions

Revision ID: f2c4d6e8a1b3
Revises: a9c3d7e4f1b2
Create Date: 2026-03-30 11:25:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "f2c4d6e8a1b3"
down_revision = "a9c3d7e4f1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("certificate_type", sa.String(), nullable=False, server_default="digital"),
    )
    op.add_column(
        "transactions",
        sa.Column("shipping_required", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "transactions",
        sa.Column("shipping_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.add_column("transactions", sa.Column("shipping_rate_id", sa.String(), nullable=True))
    op.add_column("transactions", sa.Column("shipping_name", sa.String(), nullable=True))
    op.add_column("transactions", sa.Column("shipping_phone", sa.String(), nullable=True))
    op.add_column("transactions", sa.Column("shipping_address", sa.JSON(), nullable=True))

    op.execute(
        """
        UPDATE transactions
        SET certificate_type = 'digital',
            shipping_required = false,
            shipping_amount = 0
        WHERE certificate_type IS NULL
        """
    )

    op.alter_column("transactions", "certificate_type", server_default=None)
    op.alter_column("transactions", "shipping_required", server_default=None)
    op.alter_column("transactions", "shipping_amount", server_default=None)


def downgrade() -> None:
    op.drop_column("transactions", "shipping_address")
    op.drop_column("transactions", "shipping_phone")
    op.drop_column("transactions", "shipping_name")
    op.drop_column("transactions", "shipping_rate_id")
    op.drop_column("transactions", "shipping_amount")
    op.drop_column("transactions", "shipping_required")
    op.drop_column("transactions", "certificate_type")
