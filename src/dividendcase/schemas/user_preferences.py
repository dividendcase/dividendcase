from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


VALID_BENCHMARKS = Literal["SP500", "FTSE100", "NIFTY50", "ASX200", "TSX60"]
VALID_DATE_FORMATS = Literal["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]
VALID_MARKETS = Literal["SP500", "NIFTY50", "TSX60", "ASX200", "FTSE100", "ISEQ20", "HIGH_YIELD"]


class UserPreferences(BaseModel):
    @field_validator("withholding_overrides", mode="before")
    @classmethod
    def _none_is_empty(cls, v):
        return v or {}

    default_benchmark: str = "SP500"
    date_format: str = "DD/MM/YYYY"
    watchlist_collapsed: bool = False
    check_for_updates: bool = True
    home_currency: Optional[str] = None
    tax_residence: Optional[str] = None
    screener_markets: Optional[list[str]] = None  # None = every market
    setup_completed_at: Optional[datetime] = None
    withholding_overrides: dict[str, float] = {}

    model_config = {"from_attributes": True}


class UserPreferencesUpdate(BaseModel):
    default_benchmark: Optional[VALID_BENCHMARKS] = None
    date_format: Optional[VALID_DATE_FORMATS] = None
    watchlist_collapsed: Optional[bool] = None
    check_for_updates: Optional[bool] = None
    home_currency: Optional[str] = Field(None, pattern=r"^[A-Z]{3}$")
    tax_residence: Optional[str] = Field(None, pattern=r"^[A-Z]{2}$")
    screener_markets: Optional[list[VALID_MARKETS]] = None
    # True when the first-run setup screen is finished
    complete_setup: Optional[bool] = None
    # Rates to use instead of the estimates, percent by source country; null removes one
    withholding_overrides: Optional[dict[str, Optional[float]]] = None

    @field_validator("withholding_overrides")
    @classmethod
    def _check_overrides(cls, v):
        return None if v is None else valid_overrides(v)


def valid_overrides(value: dict[str, Optional[float]]) -> dict[str, Optional[float]]:
    for country, rate in value.items():
        if not (1 <= len(country) <= 40):
            raise ValueError(f"Not a country: {country!r}")
        if rate is not None and not (0 <= rate <= 100):
            raise ValueError(f"A withholding rate is a percentage from 0 to 100, not {rate}")
    return value
