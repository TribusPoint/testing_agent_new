"""persona goal personality knowledge_level

Revision ID: b8e2f1a3c4d5
Revises: 43f0e18ac6f0
Create Date: 2026-04-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8e2f1a3c4d5"
down_revision: Union[str, None] = "43f0e18ac6f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("personas", sa.Column("goal", sa.Text(), nullable=True))
    op.add_column("personas", sa.Column("personality", sa.Text(), nullable=True))
    op.add_column("personas", sa.Column("knowledge_level", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("personas", "knowledge_level")
    op.drop_column("personas", "personality")
    op.drop_column("personas", "goal")
