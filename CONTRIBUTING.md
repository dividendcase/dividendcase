# Contributing to DividendCase

Thanks for helping. DividendCase is young, and the most useful thing right now is **trying it and telling us what breaks or confuses you**.

## Reporting a problem or an idea

- **Something isn't working:** [open a bug report](https://github.com/dividendcase/dividendcase/issues/new?template=bug_report.yml). **Report a problem** in the app's ⌘K menu fills in your version and system for you.
- **An idea:** [describe what you're trying to do](https://github.com/dividendcase/dividendcase/issues/new?template=idea.yml).
- **A security problem:** please don't open a public issue; see [SECURITY.md](SECURITY.md).

Please leave out anything private: no portfolio files, account numbers or unblurred screenshots of real balances.

## Code

DividendCase is open source, but not open to outside code: we write every change ourselves, so pull requests are open to the maintainers only. If you'd like something built or fixed, **open an issue** describing what you need and why, and we'll pick it up from there. Please describe the change in words rather than pasting code; we write it from the description.

You're free to run, study and change the code for yourself under the [licence](LICENSE). The notes below are how we build and check it.

### Setting up

You need [uv](https://docs.astral.sh/uv/) and Node.js 20.9 or newer.

```bash
git clone https://github.com/dividendcase/dividendcase
cd dividendcase
uv sync
npm install
uv run python scripts/build_web.py      # build the interface into the package
uv run dividendcase                      # http://127.0.0.1:8765/dashboard/
```

For interface work, run the API with `uv run dividendcase --no-browser` and the interface with hot reload with `npm run dev:app` (http://localhost:3000).

### Checks before a change

```bash
uv run pytest                                # real SQLite, no network
uv run python -m dividendcase.migrate check  # models and migrations agree
npx tsc --noEmit -p frontend && npx tsc --noEmit -p site
```

- **Database changes** go through a migration: change the model, run `uv run python -m dividendcase.migrate new "what changed"`, and review the generated file.
- **Never add market data** to the repository (no Yahoo Finance dumps, seeds or fixtures): each installation fetches its own. Tests use invented numbers.
- **Python tooling is uv only** (no pip, venv or conda).
- The interface follows the brand rules in [CLAUDE.md](CLAUDE.md#design-rules-brand): green for money, amber and red only for risk, numbers in Geist Mono.

## Licence

DividendCase is licensed under [AGPL-3.0-or-later](LICENSE). The DividendCase name and logo are not covered by the licence.
