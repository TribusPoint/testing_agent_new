"""initiating_questions.agent_id nullable for LLM-generated questions

Revision ID: d1e2f3a4b5c6
Revises: c4d5e6f7a8b0
Create Date: 2026-04-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import UUID


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c4d5e6f7a8b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    for fk in insp.get_foreign_keys("initiating_questions"):
        if fk.get("referred_table") == "agents" and "agent_id" in fk.get("constrained_columns", []):
            op.drop_constraint(fk["name"], "initiating_questions", type_="foreignkey")
            break
    op.alter_column(
        "initiating_questions",
        "agent_id",
        existing_type=UUID(as_uuid=False),
        nullable=True,
    )
    op.create_foreign_key(
        "initiating_questions_agent_id_fkey",
        "initiating_questions",
        "agents",
        ["agent_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.execute("DELETE FROM initiating_questions WHERE agent_id IS NULL")
    bind = op.get_bind()
    insp = inspect(bind)
    for fk in insp.get_foreign_keys("initiating_questions"):
        if fk.get("referred_table") == "agents" and "agent_id" in fk.get("constrained_columns", []):
            op.drop_constraint(fk["name"], "initiating_questions", type_="foreignkey")
            break
    op.alter_column(
        "initiating_questions",
        "agent_id",
        existing_type=UUID(as_uuid=False),
        nullable=False,
    )
    op.create_foreign_key(
        "initiating_questions_agent_id_fkey",
        "initiating_questions",
        "agents",
        ["agent_id"],
        ["id"],
        ondelete="CASCADE",
    )
