"""latest price on stocks

Revision ID: 0005
Revises: 0004
Created: 2026-10-03 22:57:11.472701
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = '0005'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('stocks', schema=None) as batch_op:
        batch_op.add_column(sa.Column('last_price', sa.Numeric(precision=12, scale=4), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('stocks', schema=None) as batch_op:
        batch_op.drop_column('last_price')
