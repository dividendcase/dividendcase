# DividendCase (open-source local app): Claude Code reference

Local-first, single-user dividend tracker. The user runs `dividendcase`; it serves a static
Next.js interface and a FastAPI API on 127.0.0.1:8765 and stores everything in one SQLite file.
Licence: AGPL-3.0-or-later. GitHub: `dividendcase/dividendcase` (public; one fresh commit at 0.1.0).
Local folder is `~/Github/dividendcase-app` because macOS treats `dividendcase` and the older
`DividendCase` repo (the hosted site) as the same folder name.

## Layout

```
src/dividendcase/      Python package (FastAPI app, models, Yahoo fetcher, CLI)
  cli.py               `dividendcase` command: uvicorn on 127.0.0.1 + opens the browser
  config.py            settings (DIVIDENDCASE_* env vars); data dir via platformdirs
  database.py          async SQLAlchemy on SQLite (WAL, foreign keys on)
  api/v1/deps.py       LOCAL_USER_ID: the single local user; no auth
  services/refresh.py  background refresh: one worker, priority queue (holdings > screener),
                       paced ~1 req/s, waits out Yahoo cooldowns; runs logged in scheduler_runs
  services/universe.py screener stock lists (curated index members, S&P 500 from Wikipedia)
  services/derived.py  payment frequency + yield consistency from a stock's own dividends
                       (stored at fetch time; filled from stored dividends at startup)
  services/fx.py       ECB euro reference rates in fx_rates (one row per day, JSON of rates):
                       full history once (~640 KB zip), then the 90-day XML; RateTable +
                       convert() (GBp/ZAc/ILA minor units); GET /fx/rates, /fx/currencies
  services/updates.py  daily PyPI version check: UpdateNotice in the sidebar and one message in the
                       terminal; install_method (DIVIDENDCASE_INSTALL_METHOD=docker in the image)
                       switches the instructions to docker pull
  services/withholding.py dividend withholding at source: rule_for(source, residence, overrides)
                       for IE/GB/IN/CA/AU/US (treaty/statutory/domestic; India's ₹10,000 TDS
                       threshold); source_country() = company country, else exchange; other
                       countries → None (shown gross, listed in unestimated_sources). The calendar
                       adds withholding_rate/net_amount per entry and net totals; GET /withholding
                       (?ticker=) for Settings and stock pages. Rates need a tax professional's
                       review before 1.0.
  services/benchmark.py beats_benchmark: 10-year (or since first payment, min 3 y) total return vs
                       the exchange's index (EXCHANGE_BENCHMARKS), weekly + after screener batches
  api/v1/data.py       GET /data/status, POST /data/refresh (Data page)
  web/                 built interface (gitignored; filled by scripts/build_web.py)
package.json           npm workspaces: frontend, site, packages/*  (one root package-lock.json)
packages/brand/        tokens.css (Tailwind v4 @theme static: colours, fonts, radii, utilities
                       num / eyebrow / serif-accent / keeper-dot) + src/logo.tsx (LogoMark, Logo)
frontend/              the app: Next 16 App Router, React 19, Tailwind 4, TS 7, ECharts 6;
                       static export (output: "export", trailingSlash)
site/                  dividendcase.com: Next 16 static export + Motion; not deployed yet
                       (the hosted repo keeps serving dividendcase.com until 1 Nov 2026)
scripts/build_web.py   npm ci (root) + build frontend + copy frontend/out into src/dividendcase/web
scripts/smoke_test.py  start an installed `dividendcase` on a temp data folder and check it (pass the
                       full path locally: `uv run` puts this repo's own environment first on PATH)
Dockerfile             node → uv build wheel → uv pip install --system; listens on 0.0.0.0 inside,
                       data in /data, non-root; publish with -p 127.0.0.1:8765:8765
.github/ISSUE_TEMPLATE bug_report.yml (version/system prefilled by lib/feedback.ts), idea.yml
```

## Interface map (frontend/)

- `/dashboard/` Income home (lib/income.ts builds it from the calendar + holdings); welcome
  screen when there are no holdings. `/dashboard?ticker=X` redirects to the stock page.
- `/dashboard/stock/?t=KO` stock analysis; `/dashboard/screener/` filters every stored payer
  client-side (GET /stocks/top-performers?limit=2000); `/dashboard/compare/?tickers=KO,PEP`.
- `/dashboard/investments/` (+ `/portfolio/?id=N`, `?add=1` opens the add dialog), calendar,
  watchlist, drip, data, settings, about.
- Shell: `components/layout/` Sidebar, Header, `AppActions` (context: `openImport`,
  `openCommand`, export, report; mounts the one ImportExcelDialog and the ⌘K CommandPalette).
- First run: `components/setup/FirstRunSetup.tsx` (tax residence, home currency, screener
  markets) shows until `setup_completed_at` is set; "Set up later" hides it for the session.
  Scheduled screener downloads wait for it; finishing it (or changing markets) queues them.
- After tax: `lib/withholding.ts` `calendarFor(calendar, view)` swaps in net amounts (gross kept as
  `gross_amount`), so pages reuse their code; `useTaxView()` is shared and remembered;
  Settings → Tax withheld at source (WithholdingSettings) edits `withholding_overrides`.
- Money in one currency: `lib/fx.ts` (`useHomeCurrency`, `convertAmount` at latest rates for
  future income, `usePortfolioCost` = lots at purchase-date rates from GET /portfolio/cost);
  `/portfolio/analysis?currency=EUR` converts every amount at its own date (benchmark too).
  Pages offer "All in {home}" first, then one currency at a time.
- Building blocks: `PageHeader`, `ui/stat`, `ui/segmented` (Segmented, Chip), `ui/table`,
  `ui/empty-state`, `ui/ticker-badge`, `ui/tooltip` (InfoTip), `lib/format.ts` (formatMoney
  shows GBp pence as £; currencyLabel), charts through `components/charts/EChart.tsx` with the
  theme in `lib/chartTheme.ts` (chartColors, categorical, lineSeries).

## Commands

```bash
uv sync
npm install                    # root: installs all workspaces (Node 20.9+)
uv run python scripts/build_web.py
uv run dividendcase            # or: uv run dividendcase --no-browser
npm run dev:app                # interface on :3000, API URL from frontend/.env.development
npm run dev:site               # website on :3002
npx tsc --noEmit -p frontend && npx tsc --noEmit -p site
```

uv is the only Python tool (no pip, venv or conda). Use `DIVIDENDCASE_DATA_DIR=<tmp>` for tests
so the user's real data folder is never touched, and `DIVIDENDCASE_AUTO_REFRESH=false` so only
the refreshes a test triggers run. `.claude/launch.json` (gitignored) is kept to two entries
for Pratik's Servers menu: `DividendCase` (real data, :8765) and `Website` (:3002). For test
data, run the API by hand with `DIVIDENDCASE_DATA_DIR=.test-data DIVIDENDCASE_AUTO_REFRESH=false
DIVIDENDCASE_CORS_ORIGINS=http://localhost:3001 uv run dividendcase --no-browser --port 8766` and
`NEXT_PUBLIC_API_URL=http://127.0.0.1:8766 npm run dev -w frontend -- --port 3001`, then open
the URL (the preview tool has read the old repo's launch.json even after the session moved).

## Tests, migrations and CI

- `uv run pytest`: tests/ runs the real app (TestClient) on a real SQLite file in a temp folder.
  `conftest.py` turns the network off and stands in `FakeMarket` (invented numbers, never Yahoo
  data) for YahooFetcher, asset profiles, benchmarks and the screener list; the refresh pacing is 0.
- Schema changes go through Alembic, run by the app at startup (`dividendcase/migrate.py`,
  migrations in `src/dividendcase/migrations/versions/`, ids 0001, 0002…). Change the model, then
  `uv run python -m dividendcase.migrate new "what changed"`, review the file, and
  `... migrate check`. Batch mode (SQLite). Databases from before migrations are stamped 0001.
  Before upgrading a file with data, a VACUUM INTO copy goes to `<data dir>/backups/` (last 5 kept).
- Update check: once a day (scheduler), unless Settings → Check for updates is off or
  `DIVIDENDCASE_CHECK_UPDATES=false`; PyPI JSON API only; shown in the sidebar (UpdateNotice).
- Releases (`.github/workflows/release.yml`): set `version` in pyproject.toml, rename CHANGELOG.md's
  `## Unreleased` to `## <version>`, `uv lock`, merge, then push the tag `v<version>`; afterwards
  bump main to the next `.dev0` and add a fresh `## Unreleased`. The
  workflow checks tag = version = changelog, tests, builds the interface into the wheel
  (`scripts/check_dist.py`), installs it on Linux/macOS/Windows and runs `scripts/smoke_test.py`,
  publishes to PyPI by trusted publishing (no tokens in the repo; PyPI publisher: owner
  dividendcase, repo dividendcase, workflow release.yml, no environment), then creates the GitHub
  release from the changelog, then pushes the Docker image (linux/amd64 + arm64) to
  ghcr.io/dividendcase/dividendcase:<version> and :latest. "Run workflow" by hand = TestPyPI dry run. No GitHub environments:
  the free plan has none for private repos; add a protected `pypi` environment once public.
  Pushing a release tag publishes publicly: always ask Pratik first.
- CI: `.github/workflows/tests.yml` (pytest + migrate check; Linux/3.12 on PRs; on main also
  Python 3.11 and 3.13, macOS and Windows) and `build.yml` (type-check both apps, build the site;
  build the wheel, `scripts/check_dist.py`, then `uv tool install` it and run
  `scripts/smoke_test.py`, on all three systems on main). README badges: Tests, Build, Release, PyPI. `uv build` makes the wheel from the sdist, so the sdist carries
  `src/dividendcase/web/**` as an artifact.

## Design rules (brand)

- Dark first. Green (sprout #7abf50) = money earned and primary actions; lavender (dial) =
  Keeper/AI only; amber (watch) / red (cut) = risk only, always with an arrow, sign or label.
- Geist for UI, Geist Mono (`num`) for every number, Instrument Serif italic (`serif-accent`)
  for at most one word in a hero headline. Sentence case labels. No emoji.
- Use the brand classes (`bg-surface`, `bg-raised`, `border-line`, `text-ink-2`, `text-money`,
  `text-watch`, `text-cut`) rather than Tailwind palette colours.
- `next dev` would write AGENTS.md/CLAUDE.md into the workspace; `agentRules: false` stops it.

## Rules

- **Never ship Yahoo data.** No seed files, dumps or fixtures with market data in the repo or
  releases; every install fetches its own (yfinance, personal use).
- Single user: rows keep a `user_id` column set to `LOCAL_USER_ID`.
- Static export constraints: no middleware, route handlers, server actions or dynamic segments.
  Portfolio pages use `/dashboard/investments/portfolio/?id=N`.
- The API client (`frontend/lib/api/backend.ts`) calls the same origin; `API_BASE` comes from
  `NEXT_PUBLIC_API_URL` only in development.
- Refresh: holdings and watchlist stocks fetch with company profiles; screener stocks skip the
  profile lookup (Yahoo rate-limits it first) and leave existing profile fields untouched.
  Adding a holding fetches it at once (and queues a retry if that fails); adding to a watchlist
  or importing a file queues missing stocks. Schedules: startup, holdings
  every 6 h if older than 20 h, screener daily if older than 7 days.
- No mock DB in tests: run them against a real SQLite file.
- Commit once at the end of a piece of work, not mid-task.

## Next milestones

In order; details and decisions are in `docs/roadmap.md`. Early testers have had it since 0.1.0 (29 Sep 2026); collect their issues on GitHub.

1. Landing page redesign (October 2026): one continuous scroll film (GSAP ScrollTrigger + Motion +
   three.js), storyboard reviewed first. It goes live as dividendcase.com on 1 Nov 2026, not earlier:
   the hosted app keeps working until closure day.
2. Broker imports: Zerodha, Angel One (0.4.0), then Trading 212, Revolut, Degiro (0.5.0).
3. Withholding: a tax professional's review of the rate table; more source countries (DE, FR, NL,
   CH, ES, JP); Australian unfranked parts; Irish DWT exemptions.
4. Contributions: no CLA and no outside code (decided 29 Sep 2026). People propose work in issues and
   we write it, so Pratik stays the sole copyright holder; pull requests are limited to collaborators.
   Never copy code pasted into an issue or comment: write it from the description.
Billing and any paid Cloud launch come later; for now the focus is this app and a Cloud prototype.
