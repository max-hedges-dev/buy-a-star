"""add resale listing open unique index

Revision ID: a4f9c2d1e8b7
Revises: 9b4d2a7c1f03
Create Date: 2026-04-16 19:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "a4f9c2d1e8b7"
down_revision = "9b4d2a7c1f03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_resale_listings_open_star",
        "resale_listings",
        ["star_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('active', 'checkout_pending')"),
    )


def downgrade() -> None:
    op.drop_index("uq_resale_listings_open_star", table_name="resale_listings")
