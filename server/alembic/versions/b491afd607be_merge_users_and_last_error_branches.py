"""merge users and last_error branches

Revision ID: b491afd607be
Revises: a1b2c3d4e5f6, e2f3a4b5c6d7
Create Date: 2026-04-08 22:37:47.170874

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b491afd607be'
down_revision: Union[str, None] = ('a1b2c3d4e5f6', 'e2f3a4b5c6d7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
