# Changelog

All notable changes to DividendCase. Versions follow [semantic versioning](https://semver.org/);
while the version starts with 0, a minor release (0.2, 0.3…) may change things.

## Unreleased

- **Import from Zerodha:** in Import, choose Zerodha and add the tradebooks you download from Console (Reports, Tradebook; CSV or Excel, one per year). The app matches each sale with the earliest buy of the same stock, combines buys made on the same day, and shows the holdings it worked out before adding anything. Lots already in the app are skipped, so importing again adds only what's new. DividendCase never connects to Zerodha: the files are read on your computer and not kept.
- **Holdings that pay no dividends now have a value.** Index funds, gold ETFs and growth stocks are stored with their price and company profile, so Holdings shows their price, value and total return, and "Current value" counts every stock. Before, they showed "—" and the Income page said they were still waiting for data. The diversification charts show them as "No dividends" under payment frequency. The screener still lists dividend payers only.
- Current value uses each stock's latest close, not the price on its last dividend date.
- Adding a holding no longer fails with an error when the same stock is being downloaded in the background at that moment (just added to a watchlist, say): saving a stock and its dividends is now one step, so two downloads can't clash.
- The "Beat their index" comparison reads the stocks after downloading the indices, so a stock updated during the download is judged on its new data.
- "Report a problem" fills in Docker, not uv, as the install method when you run the Docker image.
- CONTRIBUTING.md: DividendCase takes ideas and bug reports as issues and writes every change itself, so pull requests are open to the maintainers only.

## 0.3.0

- **Income after tax:** the Income and Calendar pages show dividends after the tax the paying country withholds (switch to "Before tax" any time). Rates for residents of Ireland, the UK, India, Canada, Australia and the US, by treaty where one applies, with the paperwork each assumes (a W-8BEN for US dividends, for example). Countries it doesn't cover yet are shown before tax and named. Settings lists every rate and lets you set the one your broker actually uses; stock pages show what's withheld for you.
- Stock suggestions (Compare, Watchlists, DRIP, Add holding) no longer get cut off by the card or dialog they're in.

## 0.2.0

- **Screener:** a "Beat their index" filter and a "Vs index" column: price change plus dividends over the last ten years (or since the first stored payment, if at least three years ago) against the stock's local index over the same period, recomputed weekly and after each screener refresh.
- **Docker image** at `ghcr.io/dividendcase/dividendcase`, for Intel and ARM.
- **Update notices:** the terminal now says when a new version is out, with the command to run, and "What's new" opens that version's release notes. Docker installs get Docker instructions.
- **Feedback:** a Send feedback link in the sidebar and "Report a problem" / "Suggest an idea" in the ⌘K palette open GitHub forms with your version filled in. CONTRIBUTING.md and SECURITY.md.

## 0.1.1

- The browser now opens once DividendCase is ready. On the first start after installing or updating, which can take up to a minute while Python prepares its libraries, it used to open too early and show "This site can't be reached". The terminal now says it's starting and when it's ready.
- The website's install steps no longer say "coming soon".

## 0.1.0

The first release of DividendCase as an app that runs on your own computer.

- **Income home:** what your holdings should pay over the next 12 months, month by month, with upcoming payments, where the income comes from and a few plain-English notes.
- **One currency:** totals across USD, GBP, EUR, INR, CAD, AUD and more are converted into your home currency with the European Central Bank's daily reference rates. Past amounts use the rate on their date, future income the latest rate.
- **First-run setup:** tax residence, home currency and which markets the screener downloads.
- **Stock pages:** 10 years of dividend history, TTM and forward yield, a safety score, dividend growth and growth streaks.
- **Screener:** index members of the S&P 500, NIFTY 50, TSX 60, FTSE 100, ISEQ 20 and ASX 200, plus high-yield groups, filtered by market, yield and how often they pay.
- **Portfolios:** up to four, with individual purchase lots in any currency, performance against a benchmark and diversification charts.
- **Income calendar, watchlists, side-by-side comparison and a DRIP calculator.**
- **Excel import and export** of portfolios, holdings and watchlists, and an Excel report.
- **⌘K search** for any stock, page or action.
- **Your data stays on your computer:** one SQLite file, market data fetched by your computer from Yahoo Finance for your own use, a copy saved before every upgrade, and a daily check for new versions that you can turn off.
