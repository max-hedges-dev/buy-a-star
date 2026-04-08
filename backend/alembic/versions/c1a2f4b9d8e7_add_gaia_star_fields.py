"""add gaia star fields

Revision ID: c1a2f4b9d8e7
Revises: 7f1b3b4d91f0
Create Date: 2026-03-23 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c1a2f4b9d8e7"
down_revision = "7f1b3b4d91f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("stars", sa.Column("source_catalog", sa.String(), nullable=True))
    op.add_column("stars", sa.Column("source_id", sa.String(), nullable=True))
    op.add_column("stars", sa.Column("display_name", sa.String(), nullable=True))
    op.add_column("stars", sa.Column("ra_degrees", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("x_pc", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("y_pc", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("z_pc", sa.Float(), nullable=True))
    op.create_index(op.f("ix_stars_source_id"), "stars", ["source_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_stars_source_id"), table_name="stars")
    op.drop_column("stars", "z_pc")
    op.drop_column("stars", "y_pc")
    op.drop_column("stars", "x_pc")
    op.drop_column("stars", "ra_degrees")
    op.drop_column("stars", "display_name")
    op.drop_column("stars", "source_id")
    op.drop_column("stars", "source_catalog")
