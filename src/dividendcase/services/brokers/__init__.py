"""Broker exports turned into purchase lots.

A broker's parser reads its export into `Trade`s; `open_lots` matches sells against buys, first in
first out, and leaves the shares still held as lots (one per stock per purchase date). Nothing here
talks to a broker: the user downloads the file from their broker and hands it to the app.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional


@dataclass(frozen=True)
class Trade:
    isin: str
    symbol: str  # the broker's symbol, e.g. "ITC"
    ticker: str  # the app's (Yahoo's) ticker, e.g. "ITC.NS"
    side: str  # "buy" or "sell"
    trade_date: date
    quantity: float
    price: float
    currency: str
    trade_id: str
    executed_at: Optional[datetime] = None


@dataclass
class Lot:
    purchase_date: date
    quantity: float
    price: float


@dataclass
class Holding:
    ticker: str
    isin: str
    currency: str
    lots: list[Lot] = field(default_factory=list)

    @property
    def quantity(self) -> float:
        return sum(lot.quantity for lot in self.lots)

    @property
    def average_price(self) -> float:
        return sum(lot.quantity * lot.price for lot in self.lots) / self.quantity if self.lots else 0.0


@dataclass
class Positions:
    holdings: list[Holding]
    closed: int  # stocks bought and sold off completely within the files
    # Stocks sold beyond what the files show being bought: earlier years missing, or shares that
    # arrived without a trade (bonus issues, splits, transfers)
    oversold: list[str]


EPSILON = 1e-6


def open_lots(trades: list[Trade]) -> Positions:
    """Match sells against the earliest buys of the same stock and return what's still held."""
    by_isin: dict[str, list[Trade]] = defaultdict(list)
    for t in trades:
        by_isin[t.isin].append(t)

    holdings: list[Holding] = []
    closed = 0
    oversold: list[str] = []
    for isin, rows in by_isin.items():
        rows.sort(key=lambda t: (t.trade_date, t.executed_at or datetime.min, t.side != "buy", t.trade_id))
        lots: list[Lot] = []
        short = False
        for t in rows:
            if t.side == "buy":
                lots.append(Lot(t.trade_date, t.quantity, t.price))
                continue
            left = t.quantity
            while left > EPSILON and lots:
                take = min(left, lots[0].quantity)
                lots[0].quantity -= take
                left -= take
                if lots[0].quantity <= EPSILON:
                    lots.pop(0)
            if left > EPSILON:
                short = True
        # The latest trade names the stock (symbols change; the ISIN doesn't)
        latest = max(rows, key=lambda t: (t.trade_date, t.executed_at or datetime.min))
        if short:
            oversold.append(latest.ticker)
        if not lots:
            closed += 1
            continue
        holdings.append(Holding(latest.ticker, isin, latest.currency, _merge_same_day(lots)))
    holdings.sort(key=lambda h: h.ticker)
    return Positions(holdings, closed, sorted(oversold))


def _merge_same_day(lots: list[Lot]) -> list[Lot]:
    """One lot per purchase date (the app keeps one per stock per day), at the average price."""
    merged: dict[date, Lot] = {}
    for lot in lots:
        m = merged.get(lot.purchase_date)
        if m is None:
            merged[lot.purchase_date] = Lot(lot.purchase_date, lot.quantity, lot.price)
        else:
            total = m.quantity + lot.quantity
            m.price = (m.price * m.quantity + lot.price * lot.quantity) / total
            m.quantity = total
    return [
        Lot(d, round(m.quantity, 6), round(m.price, 4))
        for d, m in sorted(merged.items())
    ]
