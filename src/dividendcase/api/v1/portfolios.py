"""
Portfolio group management — CRUD for named portfolio containers.
Users can create up to 4 portfolios and rename them.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, func as sa_func
from uuid import UUID

from dividendcase.database import get_db
from dividendcase.models.user_portfolio import UserPortfolio
from dividendcase.models.user_investment import UserInvestment
from dividendcase.schemas.user_investment import PortfolioCreate, PortfolioUpdate, PortfolioItem
from dividendcase.api.v1.deps import _get_user_id

router = APIRouter()

MAX_PORTFOLIOS = 4


async def _ensure_default_portfolio(
    db: AsyncSession, user_id: UUID
) -> UserPortfolio:
    """If the user has no portfolios yet, create 'Portfolio 1' and backfill
    any orphan investments into it."""
    result = await db.execute(
        select(UserPortfolio)
        .where(UserPortfolio.user_id == user_id)
        .order_by(UserPortfolio.display_order)
    )
    portfolios = result.scalars().all()

    if portfolios:
        return portfolios[0]

    # Create default portfolio
    portfolio = UserPortfolio(user_id=user_id, name="Portfolio 1", display_order=0)
    db.add(portfolio)
    await db.flush()

    # Backfill any existing investments that have no portfolio
    await db.execute(
        update(UserInvestment)
        .where(
            UserInvestment.user_id == user_id,
            UserInvestment.portfolio_id.is_(None),
        )
        .values(portfolio_id=portfolio.id)
    )
    await db.commit()
    await db.refresh(portfolio)
    return portfolio


@router.get("", response_model=list[PortfolioItem])
async def list_portfolios(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    await _ensure_default_portfolio(db, user_id)
    result = await db.execute(
        select(UserPortfolio)
        .where(UserPortfolio.user_id == user_id)
        .order_by(UserPortfolio.display_order)
    )
    return result.scalars().all()


@router.post("", response_model=PortfolioItem, status_code=201)
async def create_portfolio(
    body: PortfolioCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    count_result = await db.execute(
        select(sa_func.count())
        .select_from(UserPortfolio)
        .where(UserPortfolio.user_id == user_id)
    )
    if count_result.scalar() >= MAX_PORTFOLIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum of {MAX_PORTFOLIOS} portfolios allowed",
        )

    max_order = await db.execute(
        select(sa_func.coalesce(sa_func.max(UserPortfolio.display_order), -1))
        .where(UserPortfolio.user_id == user_id)
    )
    next_order = max_order.scalar() + 1

    portfolio = UserPortfolio(
        user_id=user_id,
        name=body.name.strip(),
        display_order=next_order,
    )
    db.add(portfolio)
    await db.commit()
    await db.refresh(portfolio)
    return portfolio


@router.patch("/{portfolio_id}", response_model=PortfolioItem)
async def rename_portfolio(
    portfolio_id: int,
    body: PortfolioUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    result = await db.execute(
        select(UserPortfolio).where(
            UserPortfolio.id == portfolio_id,
            UserPortfolio.user_id == user_id,
        )
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    portfolio.name = body.name.strip()
    await db.commit()
    await db.refresh(portfolio)
    return portfolio


@router.delete("/{portfolio_id}", status_code=204)
async def delete_portfolio(
    portfolio_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    result = await db.execute(
        select(UserPortfolio).where(
            UserPortfolio.id == portfolio_id,
            UserPortfolio.user_id == user_id,
        )
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Delete investments in this portfolio (cascade should handle it, but be explicit)
    await db.execute(
        delete(UserInvestment).where(UserInvestment.portfolio_id == portfolio_id)
    )
    await db.delete(portfolio)
    await db.commit()
