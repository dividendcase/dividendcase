from fastapi import APIRouter
from dividendcase.api.v1 import stocks, dividends, search, watchlist, health, investment, portfolio, portfolios, excel_io, user, data, fx, withholding

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(stocks.router, prefix="/stocks", tags=["stocks"])
api_router.include_router(dividends.router, prefix="/dividends", tags=["dividends"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(watchlist.router, prefix="/watchlist", tags=["watchlist"])
api_router.include_router(investment.router, prefix="/investment", tags=["investment"])
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
api_router.include_router(portfolios.router, prefix="/portfolios", tags=["portfolios"])
api_router.include_router(excel_io.router, prefix="/excel", tags=["excel"])
api_router.include_router(user.router, prefix="/user", tags=["user"])
api_router.include_router(data.router, prefix="/data", tags=["data"])
api_router.include_router(fx.router, prefix="/fx", tags=["exchange rates"])
api_router.include_router(withholding.router, prefix="/withholding", tags=["withholding tax"])
