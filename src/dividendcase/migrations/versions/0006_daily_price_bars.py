"""daily price bars

Revision ID: 0006
Revises: 0005
Created: 2026-10-29 22:47:55.596789
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = '0006'
down_revision: Union[str, None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('price_bars',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('stock_id', sa.Integer(), nullable=False),
    sa.Column('ticker_symbol', sa.String(length=20), nullable=False),
    sa.Column('bar_date', sa.Date(), nullable=False),
    sa.Column('open', sa.Numeric(precision=14, scale=4), nullable=True),
    sa.Column('high', sa.Numeric(precision=14, scale=4), nullable=True),
    sa.Column('low', sa.Numeric(precision=14, scale=4), nullable=True),
    sa.Column('close', sa.Numeric(precision=14, scale=4), nullable=False),
    sa.Column('adj_close', sa.Numeric(precision=14, scale=4), nullable=False),
    sa.Column('volume', sa.BigInteger(), nullable=True),
    sa.ForeignKeyConstraint(['stock_id'], ['stocks.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('ticker_symbol', 'bar_date', name='uq_price_bar_ticker_date')
    )
    with op.batch_alter_table('price_bars', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_price_bars_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_price_bars_ticker_symbol'), ['ticker_symbol'], unique=False)

    with op.batch_alter_table('stocks', schema=None) as batch_op:
        batch_op.add_column(sa.Column('prices_fetched_at', sa.DateTime(timezone=True), nullable=True))



def downgrade() -> None:
    with op.batch_alter_table('stocks', schema=None) as batch_op:
        batch_op.drop_column('prices_fetched_at')

    with op.batch_alter_table('price_bars', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_price_bars_ticker_symbol'))
        batch_op.drop_index(batch_op.f('ix_price_bars_id'))

    op.drop_table('price_bars')
