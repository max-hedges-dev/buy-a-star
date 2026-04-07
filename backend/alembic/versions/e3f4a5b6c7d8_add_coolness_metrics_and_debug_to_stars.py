"""add coolness metrics and debug fields to stars

Revision ID: e3f4a5b6c7d8
Revises: c9e3a7b1d5f4
Create Date: 2026-04-06 19:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, Sequence[str], None] = "c9e3a7b1d5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("stars", sa.Column("bp_rp", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("bp_g", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("g_rp", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("pm", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("mass_flame", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("evolstage_flame", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("classprob_dsc_combmod_binarystar", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("valuation_scores", sa.JSON(), nullable=True))
    op.add_column("stars", sa.Column("valuation_debug", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("stars", "valuation_debug")
    op.drop_column("stars", "valuation_scores")
    op.drop_column("stars", "classprob_dsc_combmod_binarystar")
    op.drop_column("stars", "evolstage_flame")
    op.drop_column("stars", "mass_flame")
    op.drop_column("stars", "pm")
    op.drop_column("stars", "g_rp")
    op.drop_column("stars", "bp_g")
    op.drop_column("stars", "bp_rp")
