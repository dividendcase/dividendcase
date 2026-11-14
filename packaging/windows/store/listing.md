# Microsoft Store listing

Text and screenshots for the DividendCase listing in Partner Center. Paste each part into the
field named in its heading. The screenshots in this folder are 1920×1080 PNGs of the app on
the example portfolio from `scripts/demo_server.py` (invented numbers, never market data).

## Properties

| Field | Value |
|---|---|
| Category | Personal finance |
| Subcategory | Budgeting and investing (or the closest offered) |
| Privacy policy URL | https://dividendcase.com/privacy/ |
| Website | https://dividendcase.com |
| Support contact | feedback@dividendcase.com |
| Price | Free |
| Markets | All |

## Product name

DividendCase

## Short description

A free dividend tracker that runs on your own computer. Enter your holdings and see what they are expected to pay, month by month, after tax withheld at source. No account, and your portfolio never leaves your PC.

## Description

DividendCase shows what your shares are expected to pay you, and when.

Enter your holdings by hand, or import them from a spreadsheet or from a file you download from Zerodha, Angel One or Revolut. The app estimates the next 12 months of dividends from each company's own payment history and shows them month by month, in one currency.

Everything stays on your computer. There is no account to create and nothing to sign in to. DividendCase never connects to a broker or a bank: files you import are read on your PC and not kept. Your portfolio is stored in one file on your computer, and a copy is saved before an update changes it.

What you can do

- See your expected income for the next 12 months, the next payments coming up, and which holdings it comes from.
- See income after the tax the paying country withholds, for residents of Ireland, the UK, India, Canada, Australia and the US. These rates are estimates, and you can set the rate your broker really uses.
- Add up holdings in US dollars, pounds, euros, rupees, Canadian and Australian dollars in your home currency, with the European Central Bank's daily reference rates.
- Look at any stock: 10 years of dividend history, yield, dividend growth, growth streaks and a safety score.
- Screen dividend payers from the S&P 500, NIFTY 50, TSX 60, FTSE 100, ISEQ 20 and ASX 200 by market, yield and how often they pay, and see which have beaten their index.
- Chart prices with moving averages, Bollinger bands, RSI, MACD and ex-dividend dates, and compare stocks side by side.
- Keep watchlists, and try a dividend reinvestment calculator.
- Export everything to Excel whenever you like.

How it works

DividendCase opens in your web browser, but it is running on your PC, not on a website. Open it from the Start menu. A small icon by the clock lets you open it again or quit it.

Market data is downloaded by your own computer from Yahoo Finance for your personal use, and exchange rates from the European Central Bank. Nothing about you or your portfolio is sent with those requests.

DividendCase is free and open source (AGPL-3.0). The code is public at github.com/dividendcase/dividendcase.

Amounts are estimates based on past dividends. Companies can change or cancel a dividend at any time. Nothing in DividendCase is financial advice.

## What's new in this version

The first version of DividendCase in the Microsoft Store. It installs with one click and is kept up to date by the Store.

## Product features

One line each, in this order:

1. Expected dividend income for the next 12 months, month by month
2. Runs on your own computer: no account, no sign-in
3. Never connects to your broker or bank
4. Income after tax withheld at source, for six countries of residence
5. Holdings in many currencies added up in your home currency
6. Import files from Zerodha, Angel One and Revolut, or a spreadsheet
7. Stock pages with 10 years of dividend history and a safety score
8. Screener for dividend payers in six markets
9. Price charts with moving averages, RSI, MACD and ex-dividend dates
10. Watchlists, stock comparison and a reinvestment calculator
11. Export to Excel at any time
12. Free and open source

## Search terms

Up to seven:

- dividend tracker
- dividend calendar
- dividend income
- portfolio tracker
- stock screener
- dividend yield
- investing

## Screenshots

Upload in this order, with these captions:

| File | Caption |
|---|---|
| `1-income.png` | What your holdings are expected to pay over the next 12 months, after tax |
| `2-calendar.png` | Every expected payment, month by month, in one currency |
| `3-holdings.png` | Your holdings in any currency, with value and total return |
| `4-stock.png` | Dividend history, yield, growth and a safety score for any stock |
| `5-screener.png` | Screen dividend payers across six markets |
| `6-charts.png` | Price charts with moving averages, volume and trailing yield |

The numbers in the screenshots are invented for the example portfolio.

## Copyright and licence

- Copyright and trademark info: © 2026 Pratik Barve
- Additional license terms: DividendCase is free software under the GNU Affero General Public License, version 3 or later: https://github.com/dividendcase/dividendcase/blob/main/LICENSE

## Submission options: why runFullTrust

The box is short (about 500 characters) and takes only the reason:

DividendCase is a classic Win32 desktop app: a bundled Python runtime that runs a local web server on 127.0.0.1 (port 8765) and shows its interface in the user's default browser. It needs runFullTrust to start that executable (python\pythonw.exe), listen on localhost, show a notification-area icon and keep the user's portfolio in a local SQLite file. It cannot run in an AppContainer. It uses no elevation, drivers or services.

## Additional testing information

On its own page (Supplemental info):

No account or sign-in is needed, and there are no purchases. To test: open DividendCase from the Start menu. The first start can take up to a minute; the default browser then opens at http://127.0.0.1:8765/dashboard/. Answer the three setup questions, choose Holdings, then Add holding, and add 10 shares of KO. An icon in the notification area offers "Open DividendCase" and "Quit". The app downloads public market data from Yahoo Finance and exchange rates from the European Central Bank. It sends no personal data and has no advertising or analytics.

## Logos

From `packages/brand/assets/logos/` (redrawn by `packages/brand/make_logos.py`): `store-poster-*`, `store-box-*`, `store-tile-*` and `store-hero-*`. The Xbox slots stay empty.

## Submitted

1.0.0 was submitted for certification on 14 Nov 2026: all markets, public and discoverable, free, published as soon as it passes.
