"""add resale marketplace tables

Revision ID: 9b4d2a7c1f03
Revises: e3f4a5b6c7d8
Create Date: 2026-04-16 19:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "9b4d2a7c1f03"
down_revision = "e3f4a5b6c7d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("connected_account_id", sa.String(), nullable=True))
    op.add_column(
        "users",
        sa.Column("stripe_seller_onboarding_status", sa.String(), nullable=False, server_default="not_started"),
    )
    op.add_column(
        "users",
        sa.Column("stripe_seller_charges_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "users",
        sa.Column("stripe_seller_payouts_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "users",
        sa.Column("stripe_seller_details_submitted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("users", sa.Column("stripe_seller_requirements_due", sa.JSON(), nullable=True))
    op.create_index(op.f("ix_users_connected_account_id"), "users", ["connected_account_id"], unique=True)

    op.add_column("stars", sa.Column("current_owner_user_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_stars_current_owner_user_id"), "stars", ["current_owner_user_id"])
    op.create_foreign_key(
        "fk_stars_current_owner_user_id_users",
        "stars",
        "users",
        ["current_owner_user_id"],
        ["id"],
    )

    op.add_column(
        "transactions",
        sa.Column("transaction_type", sa.String(), nullable=False, server_default="primary"),
    )

    op.create_table(
        "resale_listings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("star_id", sa.Integer(), nullable=False),
        sa.Column("seller_user_id", sa.Integer(), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="gbp"),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("stripe_checkout_session_id", sa.String(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["seller_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["star_id"], ["stars.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_resale_listings_id"), "resale_listings", ["id"])
    op.create_index(op.f("ix_resale_listings_star_id"), "resale_listings", ["star_id"])
    op.create_index(op.f("ix_resale_listings_seller_user_id"), "resale_listings", ["seller_user_id"])
    op.create_index(
        op.f("ix_resale_listings_stripe_checkout_session_id"),
        "resale_listings",
        ["stripe_checkout_session_id"],
        unique=True,
    )
    op.create_index("ix_resale_listings_active_star", "resale_listings", ["star_id", "status"])

    op.create_table(
        "resale_sales",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("star_id", sa.Integer(), nullable=False),
        sa.Column("seller_user_id", sa.Integer(), nullable=False),
        sa.Column("buyer_user_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="gbp"),
        sa.Column("platform_fee_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("seller_proceeds_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(), nullable=False, server_default="checkout_created"),
        sa.Column("stripe_checkout_session_id", sa.String(), nullable=True),
        sa.Column("stripe_payment_intent_id", sa.String(), nullable=True),
        sa.Column("stripe_charge_id", sa.String(), nullable=True),
        sa.Column("stripe_transfer_id", sa.String(), nullable=True),
        sa.Column("stripe_application_fee_id", sa.String(), nullable=True),
        sa.Column("refunded_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["buyer_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["listing_id"], ["resale_listings.id"]),
        sa.ForeignKeyConstraint(["seller_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["star_id"], ["stars.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_resale_sales_id"), "resale_sales", ["id"])
    op.create_index(op.f("ix_resale_sales_listing_id"), "resale_sales", ["listing_id"])
    op.create_index(op.f("ix_resale_sales_star_id"), "resale_sales", ["star_id"])
    op.create_index(op.f("ix_resale_sales_seller_user_id"), "resale_sales", ["seller_user_id"])
    op.create_index(op.f("ix_resale_sales_buyer_user_id"), "resale_sales", ["buyer_user_id"])
    op.create_index(
        op.f("ix_resale_sales_stripe_checkout_session_id"),
        "resale_sales",
        ["stripe_checkout_session_id"],
        unique=True,
    )
    op.create_index(op.f("ix_resale_sales_stripe_payment_intent_id"), "resale_sales", ["stripe_payment_intent_id"])

    op.create_table(
        "seller_balance_ledger",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("resale_sale_id", sa.Integer(), nullable=True),
        sa.Column("entry_type", sa.String(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="gbp"),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stripe_payout_id", sa.String(), nullable=True),
        sa.Column("stripe_transfer_id", sa.String(), nullable=True),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("entry_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["resale_sale_id"], ["resale_sales.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_seller_balance_ledger_id"), "seller_balance_ledger", ["id"])
    op.create_index(op.f("ix_seller_balance_ledger_user_id"), "seller_balance_ledger", ["user_id"])
    op.create_index(op.f("ix_seller_balance_ledger_resale_sale_id"), "seller_balance_ledger", ["resale_sale_id"])
    op.create_index(op.f("ix_seller_balance_ledger_stripe_payout_id"), "seller_balance_ledger", ["stripe_payout_id"])

    op.execute(
        """
        UPDATE stars
        SET current_owner_user_id = latest.user_id
        FROM (
            SELECT DISTINCT ON (star_id) star_id, user_id
            FROM transactions
            WHERE status = 'fulfilled'
              AND user_id IS NOT NULL
            ORDER BY star_id, fulfilled_at DESC NULLS LAST, id DESC
        ) AS latest
        WHERE stars.id = latest.star_id
        """
    )

    op.alter_column("users", "stripe_seller_onboarding_status", server_default=None)
    op.alter_column("users", "stripe_seller_charges_enabled", server_default=None)
    op.alter_column("users", "stripe_seller_payouts_enabled", server_default=None)
    op.alter_column("users", "stripe_seller_details_submitted", server_default=None)
    op.alter_column("transactions", "transaction_type", server_default=None)


def downgrade() -> None:
    op.drop_table("seller_balance_ledger")
    op.drop_table("resale_sales")
    op.drop_index("ix_resale_listings_active_star", table_name="resale_listings")
    op.drop_table("resale_listings")
    op.drop_column("transactions", "transaction_type")
    op.drop_constraint("fk_stars_current_owner_user_id_users", "stars", type_="foreignkey")
    op.drop_index(op.f("ix_stars_current_owner_user_id"), table_name="stars")
    op.drop_column("stars", "current_owner_user_id")
    op.drop_index(op.f("ix_users_connected_account_id"), table_name="users")
    op.drop_column("users", "stripe_seller_requirements_due")
    op.drop_column("users", "stripe_seller_details_submitted")
    op.drop_column("users", "stripe_seller_payouts_enabled")
    op.drop_column("users", "stripe_seller_charges_enabled")
    op.drop_column("users", "stripe_seller_onboarding_status")
    op.drop_column("users", "connected_account_id")
