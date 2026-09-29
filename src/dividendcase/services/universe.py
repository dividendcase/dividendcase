"""Which stocks the screener covers.

Index members come from curated lists (and Wikipedia for the S&P 500, fetched at run
time on the user's machine). These are lists of ticker symbols only; the market data
itself is always fetched by each installation.
"""
import io
import logging
from typing import Iterable, Optional

import pandas as pd
import requests

logger = logging.getLogger(__name__)

USER_AGENT = "DividendCase/0.1 (+https://github.com/dividendcase/dividendcase)"

INDICES = {
    "SP500": {
        "name": "S&P 500",
        "country": "USA",
        "currency": "USD",
        "symbols": None,  # fetched dynamically from Wikipedia
    },
    "NIFTY50": {
        "name": "NIFTY 50",
        "country": "India",
        "currency": "INR",
        "symbols": [
            "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "HINDUNILVR.NS",
            "ICICIBANK.NS", "KOTAKBANK.NS", "BHARTIARTL.NS", "ITC.NS", "SBIN.NS",
            "LT.NS", "ASIANPAINT.NS", "AXISBANK.NS", "MARUTI.NS", "TITAN.NS",
            "NESTLEIND.NS", "HCLTECH.NS", "SUNPHARMA.NS", "ULTRACEMCO.NS", "WIPRO.NS",
            "BAJFINANCE.NS", "ONGC.NS", "TECHM.NS", "TATAMOTORS.NS", "POWERGRID.NS",
            "NTPC.NS", "JSWSTEEL.NS", "DIVISLAB.NS", "DRREDDY.NS", "INDUSINDBK.NS",
            "BAJAJFINSV.NS", "GRASIM.NS", "CIPLA.NS", "COALINDIA.NS", "EICHERMOT.NS",
            "BRITANNIA.NS", "HEROMOTOCO.NS", "BPCL.NS", "TATASTEEL.NS", "APOLLOHOSP.NS",
            "TATACONSUM.NS", "HINDALCO.NS", "BAJAJ-AUTO.NS", "GODREJCP.NS", "SHREECEM.NS",
        ],
    },
    "TSX60": {
        "name": "TSX 60",
        "country": "Canada",
        "currency": "CAD",
        "symbols": [
            "RY.TO", "TD.TO", "BNS.TO", "BMO.TO", "CM.TO",
            "ENB.TO", "TRP.TO", "SU.TO", "CNQ.TO", "FNV.TO",
            "ABX.TO", "NTR.TO", "MFC.TO", "SLF.TO", "CVE.TO",
            "AEM.TO", "CP.TO", "QSR.TO", "WSP.TO", "ATD.TO",
            "CNR.TO", "BEP-UN.TO", "WPM.TO", "WCN.TO", "IMO.TO",
        ],
    },
    "ASX200": {
        "name": "ASX 200",
        "country": "Australia",
        "currency": "AUD",
        "symbols": [
            "BHP.AX", "CBA.AX", "NAB.AX", "WBC.AX", "ANZ.AX",
            "WES.AX", "MQG.AX", "RIO.AX", "TLS.AX", "WOW.AX",
            "FMG.AX", "TCL.AX", "STO.AX", "IAG.AX", "APA.AX",
            "ORG.AX", "CHC.AX", "MGR.AX", "GPT.AX", "SCG.AX",
            "WPR.AX", "CWY.AX", "BXB.AX", "AMC.AX", "MIN.AX",
        ],
    },
    "FTSE100": {
        "name": "FTSE 100",
        "country": "UK",
        "currency": "GBP",
        "symbols": [
            "SHEL.L", "ULVR.L", "AZN.L", "GSK.L", "BP.L",
            "HSBA.L", "VOD.L", "LLOY.L", "BARC.L", "RIO.L",
            "DGE.L", "NG.L", "SSE.L", "LGEN.L", "BLND.L",
            "LAND.L", "NWG.L", "BATS.L", "IMB.L", "GLEN.L",
            "AAL.L", "PRU.L", "STAN.L", "MNG.L", "PHNX.L",
        ],
    },
    "ISEQ20": {
        "name": "ISEQ 20",
        "country": "Ireland",
        "currency": "EUR",
        "symbols": [
            "CRH.IR", "RYA.IR", "KRX.IR", "SKG.IR", "AIB.IR",
            "BIRG.IR", "FLT.IR", "GLV.IR", "DCC.IR", "IPM.IR",
            "GN5.IR", "DHG.IR", "OVH.IR", "YEW.IR", "D4E.IR",
        ],
    },
}

HIGH_YIELD_GROUPS = {
    "mortgage_reit": [
        "ORC", "AGNC", "NYMT", "NLY", "CIM", "TWO", "ARR", "IVR",
        "PMT", "DX", "MITT", "MFA", "CHMI",
    ],
    "bdc": [
        "PSEC", "MAIN", "ARCC", "HTGC", "GAIN", "TSLX",
        "GLAD", "TCPC", "FDUS", "PFLT", "CSWC", "GBDC", "SLRC", "OCSL", "ORCC",
    ],
    "closed_end_fund": [
        "ECC", "EIM", "EOS", "EOI", "EVT", "EXG", "ETG",
        "JPC", "JPS", "JPI", "JHS", "JHI", "JQC", "JFR",
        "NCV", "NCZ",
    ],
    "energy_trust": [
        "PEY.TO", "AAV.TO", "BIR.TO", "ERF.TO", "GXE.TO",
        "KEL.TO", "OBE.TO", "VET.TO", "WCP.TO", "FRU.TO",
    ],
    "utility_reit": [
        "O", "STAG", "WPC", "NNN", "ADC", "SRC",
        "AMT", "CCI", "DLR", "PLD", "EXR", "PSA",
    ],
    "tobacco_telecom": [
        "BTI", "PM", "MO", "T", "VZ", "VOD", "BCE", "TU",
        "TEF", "ORAN",
    ],
}


# Used when Wikipedia can't be reached
SP500_FALLBACK = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "JPM", "JNJ", "XOM",
    "PG", "HD", "MA", "CVX", "ABBV", "PFE", "KO", "PEP", "COST",
    "WMT", "ABT", "DHR", "ACN", "NEE", "VZ", "TXN", "LIN", "MRK",
    "T", "IBM", "MDT", "HON", "UPS", "QCOM", "PM", "LOW", "C",
    "CAT", "GE", "MMM", "CVS", "MO", "SO", "DUK", "PLD", "AMT",
    "CL", "CSX", "EOG", "APD", "CCI", "NSC", "WM", "PGR", "MMC",
]


def sp500_symbols() -> list[str]:
    """Current S&P 500 members from Wikipedia, in Yahoo's format (BRK.B -> BRK-B)."""
    try:
        resp = requests.get(
            "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
            headers={"User-Agent": USER_AGENT},
            timeout=20,
        )
        resp.raise_for_status()
        table = pd.read_html(io.StringIO(resp.text))[0]
        symbols = [str(s).strip().replace(".", "-") for s in table["Symbol"].tolist()]
        logger.info("Loaded %d S&P 500 symbols from Wikipedia", len(symbols))
        return symbols
    except Exception as e:  # network, layout change, parser
        logger.warning("Wikipedia S&P 500 list unavailable (%s); using the built-in list", e)
        return SP500_FALLBACK


HIGH_YIELD = "HIGH_YIELD"


def markets() -> list[dict]:
    """The groups a user can choose for the screener (first-run setup and Settings)."""
    groups = [
        {
            "key": key,
            "name": config["name"],
            "country": config["country"],
            "currency": config["currency"],
            "stocks": len(config["symbols"]) if config["symbols"] is not None else 500,
        }
        for key, config in INDICES.items()
    ]
    groups.append({
        "key": HIGH_YIELD,
        "name": "High-yield groups",
        "country": "USA, Canada, UK",
        "currency": "USD",
        "stocks": len({s for symbols in HIGH_YIELD_GROUPS.values() for s in symbols}),
    })
    return groups


def screener_universe(selected: Optional[Iterable[str]] = None) -> list[tuple[str, str]]:
    """(symbol, source) pairs for the screener, deduplicated, in fetch order.

    `selected` holds market keys from `markets()`; None means every market.
    """
    wanted = None if selected is None else set(selected)
    pairs: list[tuple[str, str]] = []
    for key, config in INDICES.items():
        if wanted is not None and key not in wanted:
            continue
        symbols = config["symbols"] if config["symbols"] is not None else sp500_symbols()
        pairs.extend((s, config["name"]) for s in symbols)
    if wanted is None or HIGH_YIELD in wanted:
        for group, symbols in HIGH_YIELD_GROUPS.items():
            pairs.extend((s, "high_yield_discovery") for s in symbols)
    seen: set[str] = set()
    unique = []
    for symbol, source in pairs:
        if symbol not in seen:
            seen.add(symbol)
            unique.append((symbol, source))
    return unique
