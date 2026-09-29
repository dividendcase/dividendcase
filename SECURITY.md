# Security

## Reporting a problem

Please report security problems **privately**, not as a public issue: use **[Report a vulnerability](https://github.com/dividendcase/dividendcase/security/advisories/new)** on GitHub. Include what you found, how to reproduce it and which version you used (`dividendcase --version`).

You'll get a reply within a week. Fixes go into a new release as soon as they're ready, and the report is credited unless you'd rather not be named.

## Supported versions

Only the latest release gets security fixes. The app tells you when a new version is out; update with `uv tool upgrade dividendcase`.

## How DividendCase is meant to be exposed

- The app serves on **127.0.0.1** only, so other computers can't reach it, and answers only requests addressed to `127.0.0.1` or `localhost` (which blocks DNS-rebinding attacks from web pages you visit).
- The Docker image listens inside the container; publish its port on the host's loopback address only (`-p 127.0.0.1:8765:8765`).
- There is no login: anyone who can use your computer's browser can use the app. Your data is one SQLite file in your data folder.
- The app contacts only Yahoo Finance (market data), the European Central Bank (exchange rates), Wikipedia (the S&P 500 member list) and PyPI (the daily version check, which can be turned off). Nothing is sent to DividendCase.
