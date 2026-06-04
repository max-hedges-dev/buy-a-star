"""add demo mode foundation

Revision ID: c4a8b9d1e2f6
Revises: f7b3c1d9e2a4
Create Date: 2026-06-04 18:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "c4a8b9d1e2f6"
down_revision = "f7b3c1d9e2a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("demo_role", sa.String(), nullable=True))
    op.create_index(op.f("ix_users_demo_role"), "users", ["demo_role"], unique=False)

    op.add_column("transactions", sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("transactions", sa.Column("payment_provider", sa.String(), nullable=False, server_default="stripe"))
    op.add_column("transactions", sa.Column("payment_status", sa.String(), nullable=False, server_default="pending"))

    op.add_column("registrations", sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    op.alter_column("users", "is_demo", server_default=None)
    op.alter_column("transactions", "is_demo", server_default=None)
    op.alter_column("transactions", "payment_provider", server_default=None)
    op.alter_column("transactions", "payment_status", server_default=None)
    op.alter_column("registrations", "is_demo", server_default=None)


def downgrade() -> None:
    op.drop_column("registrations", "is_demo")

    op.drop_column("transactions", "payment_status")
    op.drop_column("transactions", "payment_provider")
    op.drop_column("transactions", "is_demo")

    op.drop_index(op.f("ix_users_demo_role"), table_name="users")
    op.drop_column("users", "demo_role")
    op.drop_column("users", "is_demo")
