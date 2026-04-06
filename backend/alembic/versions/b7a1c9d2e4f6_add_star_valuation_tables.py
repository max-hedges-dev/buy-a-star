"""add star valuation tables

Revision ID: b7a1c9d2e4f6
Revises: f2c4d6e8a1b3
Create Date: 2026-04-05 18:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7a1c9d2e4f6"
down_revision: Union[str, Sequence[str], None] = "f2c4d6e8a1b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("stars", sa.Column("gaia_source_id", sa.String(), nullable=True))
    op.add_column("stars", sa.Column("phot_g_mean_mag", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("parallax", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("lum_flame", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("teff_gspphot", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("mh_gspphot", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("non_single_star", sa.Boolean(), nullable=True))
    op.add_column("stars", sa.Column("phot_variable_flag", sa.String(), nullable=True))
    op.add_column("stars", sa.Column("best_class_name", sa.String(), nullable=True))
    op.add_column("stars", sa.Column("radius_flame", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("age_flame", sa.Float(), nullable=True))
    op.add_column("stars", sa.Column("issue_price", sa.Numeric(10, 2), nullable=False, server_default="12.99"))
    op.add_column("stars", sa.Column("model_value", sa.Numeric(10, 2), nullable=True))
    op.add_column("stars", sa.Column("model_value_last_calculated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("stars", sa.Column("valuation_eligible", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("stars", sa.Column("valuation_missing_metrics", sa.JSON(), nullable=True))
    op.add_column("stars", sa.Column("ask_price", sa.Numeric(10, 2), nullable=True))
    op.add_column("stars", sa.Column("highest_bid", sa.Numeric(10, 2), nullable=True))
    op.add_column("stars", sa.Column("last_sale_price", sa.Numeric(10, 2), nullable=True))
    op.add_column("stars", sa.Column("last_sale_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_stars_gaia_source_id"), "stars", ["gaia_source_id"], unique=False)

    op.execute("UPDATE stars SET issue_price = COALESCE(price, 12.99)")

    op.create_table(
        "external_market_inputs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("market_date", sa.Date(), nullable=False),
        sa.Column("energy_symbol", sa.String(), nullable=False),
        sa.Column("metals_symbol", sa.String(), nullable=False),
        sa.Column("energy_price", sa.Numeric(18, 6), nullable=False),
        sa.Column("metals_price", sa.Numeric(18, 6), nullable=False),
        sa.Column("energy_change_ratio", sa.Float(), nullable=True),
        sa.Column("metals_change_ratio", sa.Float(), nullable=True),
        sa.Column("raw_payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "market_date", name="uq_external_market_inputs_provider_date"),
    )
    op.create_index(op.f("ix_external_market_inputs_id"), "external_market_inputs", ["id"], unique=False)
    op.create_index(op.f("ix_external_market_inputs_market_date"), "external_market_inputs", ["market_date"], unique=False)
    op.create_index(op.f("ix_external_market_inputs_provider"), "external_market_inputs", ["provider"], unique=False)

    op.create_table(
        "star_valuation_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("star_id", sa.Integer(), nullable=False),
        sa.Column("valuation_date", sa.Date(), nullable=False),
        sa.Column("issue_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("model_value", sa.Numeric(10, 2), nullable=False),
        sa.Column("energy_price", sa.Numeric(18, 6), nullable=True),
        sa.Column("metals_price", sa.Numeric(18, 6), nullable=True),
        sa.Column("energy_change_ratio", sa.Float(), nullable=True),
        sa.Column("metals_change_ratio", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["star_id"], ["stars.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("star_id", "valuation_date", name="uq_star_valuation_history_star_date"),
    )
    op.create_index(op.f("ix_star_valuation_history_id"), "star_valuation_history", ["id"], unique=False)
    op.create_index(op.f("ix_star_valuation_history_star_id"), "star_valuation_history", ["star_id"], unique=False)
    op.create_index(op.f("ix_star_valuation_history_valuation_date"), "star_valuation_history", ["valuation_date"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_star_valuation_history_valuation_date"), table_name="star_valuation_history")
    op.drop_index(op.f("ix_star_valuation_history_star_id"), table_name="star_valuation_history")
    op.drop_index(op.f("ix_star_valuation_history_id"), table_name="star_valuation_history")
    op.drop_table("star_valuation_history")

    op.drop_index(op.f("ix_external_market_inputs_provider"), table_name="external_market_inputs")
    op.drop_index(op.f("ix_external_market_inputs_market_date"), table_name="external_market_inputs")
    op.drop_index(op.f("ix_external_market_inputs_id"), table_name="external_market_inputs")
    op.drop_table("external_market_inputs")

    op.drop_index(op.f("ix_stars_gaia_source_id"), table_name="stars")
    op.drop_column("stars", "last_sale_at")
    op.drop_column("stars", "last_sale_price")
    op.drop_column("stars", "highest_bid")
    op.drop_column("stars", "ask_price")
    op.drop_column("stars", "valuation_missing_metrics")
    op.drop_column("stars", "valuation_eligible")
    op.drop_column("stars", "model_value_last_calculated_at")
    op.drop_column("stars", "model_value")
    op.drop_column("stars", "issue_price")
    op.drop_column("stars", "age_flame")
    op.drop_column("stars", "radius_flame")
    op.drop_column("stars", "best_class_name")
    op.drop_column("stars", "phot_variable_flag")
    op.drop_column("stars", "non_single_star")
    op.drop_column("stars", "mh_gspphot")
    op.drop_column("stars", "teff_gspphot")
    op.drop_column("stars", "lum_flame")
    op.drop_column("stars", "parallax")
    op.drop_column("stars", "phot_g_mean_mag")
    op.drop_column("stars", "gaia_source_id")
