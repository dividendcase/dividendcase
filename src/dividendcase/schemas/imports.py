from datetime import date
from typing import Optional

from pydantic import BaseModel


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


class BrokerImportResult(BaseModel):
    created: int
    already_there: int
    holdings: int
    portfolio_id: int
