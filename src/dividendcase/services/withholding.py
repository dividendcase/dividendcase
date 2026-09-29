"""Dividend withholding tax: how much the paying country keeps before a dividend reaches you.

v1 covers six countries, as sources and as tax residences: Ireland, the UK, India, Canada,
Australia and the US. Rates are for an individual holding shares directly (portfolio
dividends, well under 10% of the company). These are estimates of tax taken **at source**,
not the final tax you owe where you live, and not tax advice. People can set their own
rate for any country in Settings, which always wins.

Where a treaty rate depends on paperwork (a W-8BEN for US dividends, a tax residency
certificate for India) the table assumes it's done and says so in the note; without it the
statutory rate applies.

Sources (checked September 2026, to be reviewed by a tax professional before 1.0):
US IRS Publication 515 and treaty tables; Canada Revenue Agency Part XIII rates; HMRC
(no UK withholding on ordinary dividends); Irish Revenue DWT (25% from 2020); India Income
Tax Act s.195 / s.194 and the DTAAs with each country; Australian Taxation Office
(franked dividends aren't withheld).
"""
from dataclasses import dataclass
from typing import Optional

SUPPORTED = ("IE", "GB", "IN", "CA", "AU", "US")

# Rate for residents of countries without a treaty rule below (percent)
STATUTORY = {"US": 30.0, "CA": 25.0, "GB": 0.0, "IE": 25.0, "IN": 20.8, "AU": 0.0}

NAMES = {
    "IE": "Ireland", "GB": "United Kingdom", "IN": "India", "CA": "Canada", "AU": "Australia",
    "US": "United States", "ZZ": "somewhere else",
}

# Yahoo's company country (Stock.country) → ISO code
COUNTRY_CODES = {
    "united states": "US", "usa": "US", "united kingdom": "GB", "uk": "GB", "ireland": "IE",
    "india": "IN", "canada": "CA", "australia": "AU",
}

# Where a listing is when the company's country isn't stored (screener stocks)
EXCHANGE_COUNTRIES = {
    "NYSE": "US", "NASDAQ": "US", "NMS": "US", "NYQ": "US", "NGM": "US", "NCM": "US", "PCX": "US", "BTS": "US",
    "TSX": "CA", "TOR": "CA", "LSE": "GB", "ISE": "IE", "NSE": "IN", "BSE": "IN", "BOM": "IN", "ASX": "AU",
}

W8BEN = "with a W-8BEN on file with your broker; 30% without it"
TRC = "with a tax residency certificate and Form 10F given to the company or broker; 20.8% without them"


@dataclass(frozen=True)
class Rule:
    rate: float  # percent withheld
    basis: str  # "treaty", "statutory", "domestic", "none" or "override"
    note: str


def _source_rules(source: str, residence: str) -> Rule:
    if source == "GB":
        return Rule(0.0, "none", "The UK doesn't withhold tax on ordinary dividends (REIT property income is taxed at 20%).")
    if source == "AU":
        if residence == "AU":
            return Rule(0.0, "domestic", "No withholding for Australian residents; franking credits are claimed in your return.")
        return Rule(0.0, "none", "Franked dividends aren't withheld. Any unfranked part is withheld at 15% under a treaty (30% otherwise).")

    if source == residence:
        return {
            "US": Rule(0.0, "domestic", "No withholding for US residents; dividends are taxed in your return."),
            "CA": Rule(0.0, "domestic", "No withholding for Canadian residents; dividends are taxed in your return."),
            "IE": Rule(25.0, "domestic", "Irish dividend withholding tax, credited against your income tax."),
            "IN": Rule(10.0, "domestic", "10% TDS when a company pays you more than ₹10,000 in a financial year; credited against your income tax."),
        }[source]

    if source == "US":
        if residence == "IN":
            return Rule(25.0, "treaty", f"India–US treaty rate {W8BEN}.")
        if residence in ("IE", "GB", "CA", "AU"):
            return Rule(15.0, "treaty", f"Treaty rate {W8BEN}.")
    if source == "CA":
        if residence == "IN":
            return Rule(25.0, "treaty", "Canada–India treaty rate for portfolio holdings (the same as Canada's statutory rate).")
        if residence in ("US", "GB", "IE", "AU"):
            return Rule(15.0, "treaty", "Treaty rate, applied by your broker once it knows your residence (25% otherwise).")
    if source == "IE":
        return Rule(25.0, "statutory", "Irish dividend withholding tax. Residents of treaty countries can be exempt with a non-resident declaration, or reclaim the excess.")
    if source == "IN":
        treaty = {"IE": 10.0, "GB": 15.0, "AU": 15.0}
        if residence in treaty:
            return Rule(treaty[residence], "treaty", f"Treaty rate {TRC}.")
        if residence in ("US", "CA"):
            return Rule(20.8, "statutory", "20% plus 4% cess for non-residents; the treaty rate (25%) is higher, so it doesn't help.")

    return Rule(STATUTORY[source], "statutory", "The country's standard rate for non-residents; a treaty may lower it.")


INDIA_TDS_THRESHOLD_INR = 10_000


def rule_for(source: Optional[str], residence: Optional[str], overrides: Optional[dict] = None) -> Optional[Rule]:
    """The withholding that applies to dividends from `source` for a resident of `residence`.

    None when the source country isn't one v1 estimates (the dividend is shown gross).
    """
    if not source:
        return None
    overrides = overrides or {}
    if source in overrides and overrides[source] is not None:
        return Rule(float(overrides[source]), "override", "The rate you set in Settings.")
    if source not in SUPPORTED:
        return None
    return _source_rules(source, residence if residence in SUPPORTED else "ZZ")


def source_country(country: Optional[str], exchange: Optional[str]) -> Optional[str]:
    """ISO code of the country a dividend comes from: the company's, else its exchange's."""
    name = (country or "").strip()
    if name and name.lower() != "unknown":
        # A country v1 doesn't estimate (an ADR of a Spanish company, say) stays by name,
        # so it's shown gross and labelled rather than mistaken for its exchange's country
        return COUNTRY_CODES.get(name.lower(), name)
    return EXCHANGE_COUNTRIES.get((exchange or "").upper())


def withheld_rate(rule: Optional[Rule], source: Optional[str], residence: Optional[str],
                  yearly_amount_in_inr: Optional[float] = None) -> float:
    """The percentage actually withheld, after thresholds (India's ₹10,000 TDS for residents)."""
    if rule is None:
        return 0.0
    if rule.basis == "domestic" and source == "IN" and residence == "IN":
        if yearly_amount_in_inr is not None and yearly_amount_in_inr <= INDIA_TDS_THRESHOLD_INR:
            return 0.0
    return rule.rate


def table_for(residence: Optional[str], overrides: Optional[dict] = None) -> list[dict]:
    """Every supported source country and the rate a resident of `residence` would see."""
    rows = []
    for source in SUPPORTED:
        rule = rule_for(source, residence, overrides)
        default = rule_for(source, residence, None)
        rows.append({
            "source": source,
            "name": NAMES[source],
            "rate": rule.rate,
            "basis": rule.basis,
            "note": rule.note,
            "default_rate": default.rate,
            "default_note": default.note,
        })
    return rows
