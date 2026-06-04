"""add registration foundation

Revision ID: f7b3c1d9e2a4
Revises: a4f9c2d1e8b7
Create Date: 2026-06-04 16:35:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f7b3c1d9e2a4"
down_revision = "a4f9c2d1e8b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("registration_type", sa.String(), nullable=False, server_default="self"))
    op.add_column("transactions", sa.Column("recipient_name", sa.String(), nullable=True))
    op.add_column("transactions", sa.Column("recipient_email", sa.String(), nullable=True))
    op.add_column("transactions", sa.Column("dedication", sa.String(), nullable=True))
    op.add_column("transactions", sa.Column("gift_message", sa.String(), nullable=True))
    op.add_column("transactions", sa.Column("is_gift", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    op.create_table(
        "registrations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("star_id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=True),
        sa.Column("registration_number", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("purchaser_user_id", sa.Integer(), nullable=False),
        sa.Column("current_holder_user_id", sa.Integer(), nullable=True),
        sa.Column("recipient_name", sa.String(), nullable=True),
        sa.Column("recipient_email", sa.String(), nullable=True),
        sa.Column("registered_display_name", sa.String(), nullable=False),
        sa.Column("dedication", sa.Text(), nullable=True),
        sa.Column("gift_message", sa.Text(), nullable=True),
        sa.Column("is_gift", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("claim_status", sa.String(), nullable=False, server_default="not_claimable"),
        sa.Column("claim_token_hash", sa.String(), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("public_page_slug", sa.String(), nullable=False),
        sa.Column("public_page_visibility", sa.String(), nullable=False, server_default="public"),
        sa.Column("ownership_history_visibility", sa.String(), nullable=False, server_default="private"),
        sa.Column("certificate_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["current_holder_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["purchaser_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["star_id"], ["stars.id"]),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("claim_token_hash"),
        sa.UniqueConstraint("public_page_slug"),
        sa.UniqueConstraint("registration_number"),
        sa.UniqueConstraint("transaction_id"),
    )
    op.create_index(op.f("ix_registrations_id"), "registrations", ["id"], unique=False)
    op.create_index(op.f("ix_registrations_star_id"), "registrations", ["star_id"], unique=False)
    op.create_index(op.f("ix_registrations_transaction_id"), "registrations", ["transaction_id"], unique=False)
    op.create_index(op.f("ix_registrations_status"), "registrations", ["status"], unique=False)
    op.create_index(op.f("ix_registrations_purchaser_user_id"), "registrations", ["purchaser_user_id"], unique=False)
    op.create_index(op.f("ix_registrations_current_holder_user_id"), "registrations", ["current_holder_user_id"], unique=False)
    op.create_index(op.f("ix_registrations_registration_number"), "registrations", ["registration_number"], unique=True)
    op.create_index(op.f("ix_registrations_claim_status"), "registrations", ["claim_status"], unique=False)
    op.create_index(op.f("ix_registrations_claim_token_hash"), "registrations", ["claim_token_hash"], unique=True)
    op.create_index(op.f("ix_registrations_public_page_slug"), "registrations", ["public_page_slug"], unique=True)

    op.create_table(
        "ownership_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("registration_id", sa.Integer(), nullable=False),
        sa.Column("from_user_id", sa.Integer(), nullable=True),
        sa.Column("to_user_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("event_note", sa.Text(), nullable=True),
        sa.Column("public_visibility", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["from_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["registration_id"], ["registrations.id"]),
        sa.ForeignKeyConstraint(["to_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ownership_history_id"), "ownership_history", ["id"], unique=False)
    op.create_index(op.f("ix_ownership_history_registration_id"), "ownership_history", ["registration_id"], unique=False)
    op.create_index(op.f("ix_ownership_history_from_user_id"), "ownership_history", ["from_user_id"], unique=False)
    op.create_index(op.f("ix_ownership_history_to_user_id"), "ownership_history", ["to_user_id"], unique=False)
    op.create_index(op.f("ix_ownership_history_event_type"), "ownership_history", ["event_type"], unique=False)

    op.alter_column("transactions", "registration_type", server_default=None)
    op.alter_column("transactions", "is_gift", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_ownership_history_event_type"), table_name="ownership_history")
    op.drop_index(op.f("ix_ownership_history_to_user_id"), table_name="ownership_history")
    op.drop_index(op.f("ix_ownership_history_from_user_id"), table_name="ownership_history")
    op.drop_index(op.f("ix_ownership_history_registration_id"), table_name="ownership_history")
    op.drop_index(op.f("ix_ownership_history_id"), table_name="ownership_history")
    op.drop_table("ownership_history")

    op.drop_index(op.f("ix_registrations_public_page_slug"), table_name="registrations")
    op.drop_index(op.f("ix_registrations_claim_token_hash"), table_name="registrations")
    op.drop_index(op.f("ix_registrations_claim_status"), table_name="registrations")
    op.drop_index(op.f("ix_registrations_registration_number"), table_name="registrations")
    op.drop_index(op.f("ix_registrations_current_holder_user_id"), table_name="registrations")
    op.drop_index(op.f("ix_registrations_purchaser_user_id"), table_name="registrations")
    op.drop_index(op.f("ix_registrations_status"), table_name="registrations")
    op.drop_index(op.f("ix_registrations_transaction_id"), table_name="registrations")
    op.drop_index(op.f("ix_registrations_star_id"), table_name="registrations")
    op.drop_index(op.f("ix_registrations_id"), table_name="registrations")
    op.drop_table("registrations")

    op.drop_column("transactions", "is_gift")
    op.drop_column("transactions", "gift_message")
    op.drop_column("transactions", "dedication")
    op.drop_column("transactions", "recipient_email")
    op.drop_column("transactions", "recipient_name")
    op.drop_column("transactions", "registration_type")
