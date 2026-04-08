"""set first purchase price defaults to 14.99

Revision ID: c9e3a7b1d5f4
Revises: b7a1c9d2e4f6
Create Date: 2026-04-06 01:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9e3a7b1d5f4"
down_revision: Union[str, Sequence[str], None] = "b7a1c9d2e4f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("stars", "price", existing_type=sa.Numeric(10, 2), server_default="14.99")
    op.alter_column("stars", "issue_price", existing_type=sa.Numeric(10, 2), server_default="14.99")


def downgrade() -> None:
    op.alter_column("stars", "issue_price", existing_type=sa.Numeric(10, 2), server_default="12.99")
    op.alter_column("stars", "price", existing_type=sa.Numeric(10, 2), server_default="12.99")
