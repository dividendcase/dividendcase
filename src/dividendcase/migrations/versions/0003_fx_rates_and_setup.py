"""exchange rates and first-run setup

Revision ID: 0003
Revises: 0002
Created: 2026-09-29 11:56:04.116684
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('fx_rates',
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('rates', sa.JSON(), nullable=False),
    sa.Column('source', sa.String(length=20), nullable=False),
    sa.Column('fetched_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.PrimaryKeyConstraint('date')
    )
    with op.batch_alter_table('user_preferences', schema=None) as batch_op:
        batch_op.add_column(sa.Column('home_currency', sa.String(length=3), nullable=True))
        batch_op.add_column(sa.Column('tax_residence', sa.String(length=2), nullable=True))
        batch_op.add_column(sa.Column('screener_markets', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('setup_completed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('user_preferences', schema=None) as batch_op:
        batch_op.drop_column('setup_completed_at')
        batch_op.drop_column('screener_markets')
        batch_op.drop_column('tax_residence')
        batch_op.drop_column('home_currency')

    op.drop_table('fx_rates')
