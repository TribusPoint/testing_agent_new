"""site_analysis JSON on test_projects

Revision ID: c4d5e6f7a8b0
Revises: b8e2f1a3c4d5
Create Date: 2026-04-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "c4d5e6f7a8b0"
down_revision: Union[str, None] = "b8e2f1a3c4d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "test_projects",
        sa.Column("site_analysis", JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "test_projects",
        sa.Column("site_analyzed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("test_projects", "site_analyzed_at")
    op.drop_column("test_projects", "site_analysis")
