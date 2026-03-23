"""Add canonical ID and galactic coordinate fields

Revision ID: 7f1b3b4d91f0
Revises: 2f7b6d2cf8c1
Create Date: 2026-03-23 14:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7f1b3b4d91f0'
down_revision: Union[str, Sequence[str], None] = '2f7b6d2cf8c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('stars', sa.Column('canonical_id', sa.String(), nullable=True))
    op.add_column('stars', sa.Column('identifier_type', sa.String(), nullable=True))
    op.add_column('stars', sa.Column('galactic_longitude_deg', sa.Float(), nullable=True))
    op.add_column('stars', sa.Column('galactic_latitude_deg', sa.Float(), nullable=True))
    op.create_index(op.f('ix_stars_canonical_id'), 'stars', ['canonical_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_stars_canonical_id'), table_name='stars')
    op.drop_column('stars', 'galactic_latitude_deg')
    op.drop_column('stars', 'galactic_longitude_deg')
    op.drop_column('stars', 'identifier_type')
    op.drop_column('stars', 'canonical_id')
