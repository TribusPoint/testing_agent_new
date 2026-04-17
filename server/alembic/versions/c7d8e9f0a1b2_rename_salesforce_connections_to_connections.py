"""rename salesforce_connections table to connections

Revision ID: c7d8e9f0a1b2
Revises: b1667be9e400
Create Date: 2026-04-16

"""
from typing import Sequence, Union

from alembic import op


revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, None] = "b1667be9e400"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table("salesforce_connections", "connections")


def downgrade() -> None:
    op.rename_table("connections", "salesforce_connections")
