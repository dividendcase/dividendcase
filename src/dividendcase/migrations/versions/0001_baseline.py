"""baseline: the schema of the first local builds

Revision ID: 0001
Revises: nothing (databases from 0.1.0.dev builds are stamped with this revision)
Created: 2026-09-28 16:51:58.557498
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('scheduler_runs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('job_name', sa.String(length=100), nullable=True),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=True),
    sa.Column('records_updated', sa.Integer(), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('scheduler_runs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_scheduler_runs_id'), ['id'], unique=False)

    op.create_table('stocks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('ticker_symbol', sa.String(length=20), nullable=False),
    sa.Column('company_name', sa.String(length=255), nullable=False),
    sa.Column('exchange', sa.String(length=20), nullable=False),
    sa.Column('country', sa.String(length=50), nullable=True),
    sa.Column('currency', sa.String(length=10), nullable=True),
    sa.Column('sector', sa.String(length=100), nullable=True),
    sa.Column('industry', sa.String(length=100), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('market_cap', sa.BigInteger(), nullable=True),
    sa.Column('dividend_category', sa.String(length=50), nullable=True),
    sa.Column('data_source', sa.String(length=50), nullable=True),
    sa.Column('avg_dividend_yield', sa.Numeric(precision=6, scale=3), nullable=True),
    sa.Column('beats_benchmark', sa.Boolean(), nullable=True),
    sa.Column('benchmark_ticker', sa.String(length=20), nullable=True),
    sa.Column('payment_frequency', sa.String(length=20), nullable=True),
    sa.Column('yield_consistency_score', sa.Numeric(precision=4, scale=2), nullable=True),
    sa.Column('last_fetched_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('stocks', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_stocks_exchange'), ['exchange'], unique=False)
        batch_op.create_index(batch_op.f('ix_stocks_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_stocks_ticker_symbol'), ['ticker_symbol'], unique=True)

    op.create_table('user_portfolios',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('user_portfolios', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_user_portfolios_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_user_portfolios_user_id'), ['user_id'], unique=False)

    op.create_table('user_preferences',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('default_benchmark', sa.String(length=20), nullable=False),
    sa.Column('date_format', sa.String(length=20), nullable=False),
    sa.Column('watchlist_collapsed', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_table('user_watchlist_groups',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('user_watchlist_groups', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_user_watchlist_groups_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_user_watchlist_groups_user_id'), ['user_id'], unique=False)

    op.create_table('dividend_records',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('stock_id', sa.Integer(), nullable=False),
    sa.Column('ticker_symbol', sa.String(length=20), nullable=False),
    sa.Column('dividend_date', sa.Date(), nullable=False),
    sa.Column('dividend_per_share', sa.Numeric(precision=10, scale=4), nullable=False),
    sa.Column('share_price_on_dividend_date', sa.Numeric(precision=12, scale=4), nullable=True),
    sa.Column('dividend_yield_pct', sa.Numeric(precision=8, scale=4), nullable=True),
    sa.ForeignKeyConstraint(['stock_id'], ['stocks.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('ticker_symbol', 'dividend_date', name='uq_ticker_date')
    )
    with op.batch_alter_table('dividend_records', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_dividend_records_dividend_date'), ['dividend_date'], unique=False)
        batch_op.create_index(batch_op.f('ix_dividend_records_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_dividend_records_ticker_symbol'), ['ticker_symbol'], unique=False)

    op.create_table('user_investments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('ticker_symbol', sa.String(length=20), nullable=False),
    sa.Column('purchase_date', sa.Date(), nullable=False),
    sa.Column('purchase_price', sa.Numeric(precision=14, scale=4), nullable=True),
    sa.Column('quantity', sa.Numeric(precision=12, scale=4), nullable=False),
    sa.Column('purchase_currency', sa.String(length=10), nullable=True),
    sa.Column('portfolio_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.ForeignKeyConstraint(['portfolio_id'], ['user_portfolios.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'ticker_symbol', 'purchase_date', name='uq_user_investment')
    )
    with op.batch_alter_table('user_investments', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_user_investments_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_user_investments_user_id'), ['user_id'], unique=False)

    op.create_table('user_watchlists',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('ticker_symbol', sa.String(length=20), nullable=False),
    sa.Column('watchlist_group_id', sa.Integer(), nullable=True),
    sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.ForeignKeyConstraint(['watchlist_group_id'], ['user_watchlist_groups.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('user_watchlists', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_user_watchlists_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_user_watchlists_user_id'), ['user_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('user_watchlists', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_user_watchlists_user_id'))
        batch_op.drop_index(batch_op.f('ix_user_watchlists_id'))

    op.drop_table('user_watchlists')
    with op.batch_alter_table('user_investments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_user_investments_user_id'))
        batch_op.drop_index(batch_op.f('ix_user_investments_id'))

    op.drop_table('user_investments')
    with op.batch_alter_table('dividend_records', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_dividend_records_ticker_symbol'))
        batch_op.drop_index(batch_op.f('ix_dividend_records_id'))
        batch_op.drop_index(batch_op.f('ix_dividend_records_dividend_date'))

    op.drop_table('dividend_records')
    with op.batch_alter_table('user_watchlist_groups', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_user_watchlist_groups_user_id'))
        batch_op.drop_index(batch_op.f('ix_user_watchlist_groups_id'))

    op.drop_table('user_watchlist_groups')
    op.drop_table('user_preferences')
    with op.batch_alter_table('user_portfolios', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_user_portfolios_user_id'))
        batch_op.drop_index(batch_op.f('ix_user_portfolios_id'))

    op.drop_table('user_portfolios')
    with op.batch_alter_table('stocks', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_stocks_ticker_symbol'))
        batch_op.drop_index(batch_op.f('ix_stocks_id'))
        batch_op.drop_index(batch_op.f('ix_stocks_exchange'))

    op.drop_table('stocks')
    with op.batch_alter_table('scheduler_runs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_scheduler_runs_id'))

    op.drop_table('scheduler_runs')
