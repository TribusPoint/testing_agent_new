"""member company profiles, edit requests, purge non-admin users

Revision ID: f8e9d0c1b2a3
Revises: c7d8e9f0a1b2
Create Date: 2026-04-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f8e9d0c1b2a3"
down_revision: Union[str, None] = "c7d8e9f0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "member_company_profiles",
        sa.Column("user_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("company_name", sa.Text(), nullable=False),
        sa.Column("company_url", sa.Text(), nullable=False),
        sa.Column("industry", sa.Text(), nullable=False),
        sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("site_analysis", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("site_analyzed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "company_profile_edit_requests",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("proposed_company_name", sa.Text(), nullable=False),
        sa.Column("proposed_company_url", sa.Text(), nullable=False),
        sa.Column("proposed_industry", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_company_profile_edit_requests_user_pending",
        "company_profile_edit_requests",
        ["user_id", "status"],
    )

    # Keep only the seeded admin account (admin@admin.com).
    op.execute(
        sa.text(
            """
            DELETE FROM password_reset_requests
            WHERE user_id IN (SELECT id FROM users WHERE email <> 'admin@admin.com')
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE api_keys SET user_id = NULL
            WHERE user_id IN (SELECT id FROM users WHERE email <> 'admin@admin.com')
            """
        )
    )
    op.execute(sa.text("DELETE FROM users WHERE email <> 'admin@admin.com'"))


def downgrade() -> None:
    op.drop_index("ix_company_profile_edit_requests_user_pending", table_name="company_profile_edit_requests")
    op.drop_table("company_profile_edit_requests")
    op.drop_table("member_company_profiles")
