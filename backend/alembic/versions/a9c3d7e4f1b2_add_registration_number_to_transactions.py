"""add registration number to transactions

Revision ID: a9c3d7e4f1b2
Revises: e8b1f4c2d6a9
Create Date: 2026-03-29 23:35:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a9c3d7e4f1b2"
down_revision = "e8b1f4c2d6a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("registration_number", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_transactions_registration_number"),
        "transactions",
        ["registration_number"],
        unique=True,
    )

    op.execute(
        """
        UPDATE transactions
        SET registration_number = CONCAT(
            'AA-',
            TO_CHAR(COALESCE(fulfilled_at, created_at), 'YYYYMMDD'),
            '-',
            LPAD(id::text, 6, '0')
        )
        WHERE registration_number IS NULL
          AND status = 'fulfilled'
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_transactions_registration_number"), table_name="transactions")
    op.drop_column("transactions", "registration_number")
