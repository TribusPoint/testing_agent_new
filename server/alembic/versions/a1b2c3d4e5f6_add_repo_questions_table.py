"""add repo_questions table

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-04-08 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "repo_questions",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("expected_answer", sa.Text(), nullable=True),
        sa.Column("domain", sa.Text(), nullable=False, server_default="general"),
        sa.Column("category", sa.Text(), nullable=False, server_default="uncategorized"),
        sa.Column("tags", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column(
            "source_project_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("test_projects.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("persona", sa.Text(), nullable=True),
        sa.Column("dimension", sa.Text(), nullable=True),
        sa.Column("dimension_value", sa.Text(), nullable=True),
        sa.Column("personality_profile", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_repo_questions_domain", "repo_questions", ["domain"])
    op.create_index("ix_repo_questions_category", "repo_questions", ["category"])


def downgrade() -> None:
    op.drop_index("ix_repo_questions_category")
    op.drop_index("ix_repo_questions_domain")
    op.drop_table("repo_questions")
