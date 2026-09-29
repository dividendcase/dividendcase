# DividendCase

[![Tests](https://github.com/dividendcase/dividendcase/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/dividendcase/dividendcase/actions/workflows/tests.yml)
[![Build](https://github.com/dividendcase/dividendcase/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/dividendcase/dividendcase/actions/workflows/build.yml)
[![Release](https://github.com/dividendcase/dividendcase/actions/workflows/release.yml/badge.svg)](https://github.com/dividendcase/dividendcase/actions/workflows/release.yml)
[![PyPI](https://img.shields.io/pypi/v/dividendcase?color=4a8c1a&label=pypi)](https://pypi.org/project/dividendcase/)
[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-5c5c70)](https://pypi.org/project/dividendcase/)
[![Licence: AGPL-3.0-or-later](https://img.shields.io/badge/licence-AGPL--3.0--or--later-4a8c1a)](https://github.com/dividendcase/dividendcase/blob/main/LICENSE)

A free, open-source dividend tracker that runs on your own computer. Your data stays with you.

> **Status:** early release (0.1). Things may still change between versions; your data is backed up before every upgrade.

## Install

DividendCase installs with [uv](https://docs.astral.sh/uv/), which also sets up Python for you.

**macOS and Linux**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv tool install dividendcase
dividendcase
```

**Windows** (PowerShell)

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
uv tool install dividendcase
dividendcase
```

It opens <http://127.0.0.1:8765/dashboard/> in your browser once it's ready; the first start after installing or updating can take up to a minute. Keep the terminal window open while you use it, and press Ctrl+C there to stop. If `dividendcase` isn't found after installing uv, run `uv tool update-shell` and open a new terminal.

- **Update:** `uv tool upgrade dividendcase`. The app tells you when a new version is out, and saves a copy of your data before an update changes it.
- **Uninstall:** `uv tool uninstall dividendcase`. Your data folder (below) stays until you delete it.

## What it does

- **Income home:** what your holdings should pay over the next 12 months, month by month, all in your home currency or one currency at a time, with upcoming payments and where the income comes from.
- **Stock pages:** 10 years of dividend history, TTM yield, a safety score, dividend growth (CAGR) and growth streaks.
- **Screener:** index members from six markets, filtered by market, yield and how often they pay.
- **Portfolios:** individual purchase lots in any currency, a 12-month income calendar, diversification charts, a benchmark comparison and a DRIP calculator.
- **Watchlists and side-by-side comparison.**
- **Excel import and export** of portfolios, holdings and watchlists.
- **⌘K search** for any stock, page or action.

## How it works

`dividendcase` starts a small web server that only this computer can reach (`127.0.0.1`) and opens it in your browser. There is no account and nothing is sent to DividendCase.

Market data is fetched **by your computer** from Yahoo Finance through [yfinance](https://github.com/ranaroussi/yfinance), for your own personal use. Everything is stored in one SQLite file:

| System | Data folder |
|---|---|
| macOS | `~/Library/Application Support/DividendCase` |
| Windows | `%LOCALAPPDATA%\DividendCase\DividendCase` |
| Linux | `~/.local/share/DividendCase` |

Set `DIVIDENDCASE_DATA_DIR` to use another folder. Before an update changes the database, the app saves a copy in the `backups` folder inside it (the last five are kept).

On first launch the app asks where you're resident for tax, which currency to show totals in, and which markets the screener should download (all of it can be changed in **Settings**). Amounts in other currencies are converted with the [European Central Bank's euro reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html), downloaded by your computer: past amounts at the rate on their date, future income at the latest rate.

Once a day the app asks [PyPI](https://pypi.org/project/dividendcase/) whether a newer version exists and says so in the sidebar. Nothing about you or your portfolio is sent; turn it off in **Settings**.

While the app is open it keeps data current in the background: your holdings and watchlist stocks
when it starts and every day, and the screener's index members (S&P 500, NIFTY 50, TSX 60,
FTSE 100, ISEQ 20, ASX 200 and some high-yield groups) every week. It fetches about one stock a
second and pauses whenever Yahoo Finance asks it to. The **Data** page shows progress.

## Run from source

You need [uv](https://docs.astral.sh/uv/getting-started/installation/) and Node.js 20.9 or newer.

```bash
git clone https://github.com/dividendcase/dividendcase
cd dividendcase
```

```bash
uv sync
uv run python scripts/build_web.py   # builds the interface into the package
uv run dividendcase                  # opens http://127.0.0.1:8765/dashboard/
```

## Develop

```bash
npm install                          # once, from the repository root (npm workspaces)
uv run dividendcase --no-browser     # API on http://127.0.0.1:8765 (docs at /docs)
npm run dev:app                      # interface with hot reload on http://localhost:3000
npm run dev:site                     # the dividendcase.com website on http://localhost:3002
```

Tests run against a real SQLite file in a temporary folder, with the network switched off and made-up market data:

```bash
uv run pytest
uv run python -m dividendcase.migrate check            # models and migrations agree
uv run python -m dividendcase.migrate new "what changed" # after changing a model
```

The repository holds three JavaScript workspaces:

| Folder | What it is |
|---|---|
| `frontend/` | The app's interface: Next.js 16, Tailwind CSS 4, ECharts |
| `site/` | The website: Next.js 16 with Motion, built to static files in `site/out` |
| `packages/brand/` | Colours, fonts and the logo, shared by both |

Both are Next.js static exports (`output: "export"`), so they can't use middleware, API routes, server actions or dynamic route segments. Pass ids as query parameters instead, such as `/dashboard/stock/?t=KO`.

### Releasing

Bump `version` in `pyproject.toml`, add a matching section to [CHANGELOG.md](https://github.com/dividendcase/dividendcase/blob/main/CHANGELOG.md), run `uv lock`, merge, then push a tag such as `v0.1.1`. The **Release** workflow tests it, installs the built package on Linux, macOS and Windows, publishes it to PyPI with trusted publishing and creates the GitHub release.

## Data and disclaimer

DividendCase is not affiliated with Yahoo. Yahoo Finance data is intended for personal use, so this project never distributes market data: each installation fetches its own. Nothing in DividendCase is financial advice.

## Licence

[AGPL-3.0-or-later](https://github.com/dividendcase/dividendcase/blob/main/LICENSE). The DividendCase name and logo are not covered by the licence.
