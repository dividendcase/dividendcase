from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ImportedLot(BaseModel):
    purchase_date: date
    quantity: float
    price: float
    # The same stock on the same date is already in the app, so importing skips it
    already_there: bool


class ImportedHolding(BaseModel):
    ticker: str
    isin: str
    currency: str
    quantity: float
    average_price: float
    lots: list[ImportedLot]


class ImportedFile(BaseModel):
    name: str
    trades: int
    first: Optional[date]
    last: Optional[date]


class BrokerPreview(BaseModel):
    broker: str
    files: list[ImportedFile]
    holdings: list[ImportedHolding]
    new_lots: int
    # Stocks bought and fully sold within the files
    closed: int
    # Stocks sold beyond what the files show being bought (earlier years, bonus shares, transfers)
    oversold: list[str]
    not_equity: int
    duplicate_trades: int
    unreadable: list[str]
    # Anything else the user should know before importing (statement gaps, holdings that don't add up)
    notes: list[str] = []
    # Rows that aren't buys or sells (cash top-ups, dividends, fees), by type: listed, not imported
    left_out: dict[str, int] = {}


class BrokerImportResult(BaseModel):
    created: int
    already_there: int
    holdings: int
    portfolio_id: int


# ── Holdings files (Angel One): the file has no purchase dates, so the user confirms them ───────────

class HoldingsFileLot(BaseModel):
    # "long": held for more than a year before the file's date; "short": within that year
    held: Literal["long", "short"]
    # The latest day this part could have been bought; the user can set the real date
    purchase_date: date
    quantity: float
    price: Optional[float]
    already_there: bool


class HoldingsFileRow(BaseModel):
    name: str
    isin: str
    # None when neither NSE's lists nor Yahoo know the ISIN (unlisted or delisted)
    ticker: Optional[str]
    found_by: Optional[Literal["nse", "yahoo"]]
    currency: str
    quantity: float
    average_price: Optional[float]
    lots: list[HoldingsFileLot]


class HoldingsFilePreview(BaseModel):
    broker: str
    as_of: Optional[date]
    holdings: list[HoldingsFileRow]
    unreadable: list[str]


class LotToAdd(BaseModel):
    ticker: str = Field(min_length=1, max_length=24, pattern=r"^[A-Za-z0-9.\-^=&]+$")
    purchase_date: date
    quantity: float = Field(gt=0, le=1_000_000)
    price: Optional[float] = Field(default=None, gt=0)
    currency: str = Field(min_length=3, max_length=3)


class LotsToAdd(BaseModel):
    portfolio_id: Optional[int] = None
    lots: list[LotToAdd] = Field(min_length=1, max_length=5000)
