"""Add HYG enrichment fields to stars

Revision ID: 2f7b6d2cf8c1
Revises: 6a60219f9f32
Create Date: 2026-03-23 14:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2f7b6d2cf8c1'
down_revision: Union[str, Sequence[str], None] = '6a60219f9f32'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('stars', sa.Column('hyg_id', sa.Integer(), nullable=True))
    op.add_column('stars', sa.Column('hip', sa.Integer(), nullable=True))
    op.add_column('stars', sa.Column('hd', sa.Integer(), nullable=True))
    op.add_column('stars', sa.Column('hr', sa.Integer(), nullable=True))
    op.add_column('stars', sa.Column('gl', sa.String(), nullable=True))
    op.add_column('stars', sa.Column('bf', sa.String(), nullable=True))
    op.add_column('stars', sa.Column('bayer', sa.String(), nullable=True))
    op.add_column('stars', sa.Column('flamsteed', sa.Integer(), nullable=True))
    op.add_column('stars', sa.Column('constellation', sa.String(), nullable=True))
    op.add_column('stars', sa.Column('spectral_type', sa.String(), nullable=True))
    op.add_column('stars', sa.Column('ra_hours', sa.Float(), nullable=True))
    op.add_column('stars', sa.Column('dec_degrees', sa.Float(), nullable=True))
    op.add_column('stars', sa.Column('distance_parsecs', sa.Float(), nullable=True))
    op.add_column('stars', sa.Column('apparent_magnitude', sa.Float(), nullable=True))
    op.add_column('stars', sa.Column('absolute_magnitude', sa.Float(), nullable=True))
    op.add_column('stars', sa.Column('luminosity', sa.Float(), nullable=True))
    op.add_column('stars', sa.Column('color_index', sa.Float(), nullable=True))
    op.add_column('stars', sa.Column('radial_velocity', sa.Float(), nullable=True))
    op.add_column('stars', sa.Column('pmra', sa.Float(), nullable=True))
    op.add_column('stars', sa.Column('pmdec', sa.Float(), nullable=True))
    op.add_column('stars', sa.Column('variable_designation', sa.String(), nullable=True))
    op.add_column('stars', sa.Column('variable_min', sa.Float(), nullable=True))
    op.add_column('stars', sa.Column('variable_max', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('stars', 'variable_max')
    op.drop_column('stars', 'variable_min')
    op.drop_column('stars', 'variable_designation')
    op.drop_column('stars', 'pmdec')
    op.drop_column('stars', 'pmra')
    op.drop_column('stars', 'radial_velocity')
    op.drop_column('stars', 'color_index')
    op.drop_column('stars', 'luminosity')
    op.drop_column('stars', 'absolute_magnitude')
    op.drop_column('stars', 'apparent_magnitude')
    op.drop_column('stars', 'distance_parsecs')
    op.drop_column('stars', 'dec_degrees')
    op.drop_column('stars', 'ra_hours')
    op.drop_column('stars', 'spectral_type')
    op.drop_column('stars', 'constellation')
    op.drop_column('stars', 'flamsteed')
    op.drop_column('stars', 'bayer')
    op.drop_column('stars', 'bf')
    op.drop_column('stars', 'gl')
    op.drop_column('stars', 'hr')
    op.drop_column('stars', 'hd')
    op.drop_column('stars', 'hip')
    op.drop_column('stars', 'hyg_id')
