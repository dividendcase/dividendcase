"""preference: check for updates

Revision ID: 0002
Revises: 0001
Created: 2026-09-28 16:52:14.951913
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('user_preferences', schema=None) as batch_op:
        batch_op.add_column(sa.Column('check_for_updates', sa.Boolean(), server_default=sa.text('1'), nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('user_preferences', schema=None) as batch_op:
        batch_op.drop_column('check_for_updates')
