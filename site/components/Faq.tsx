import { ChevronDown } from "lucide-react";
import { DATA_FOLDERS, GITHUB_URL, LOCAL_URL } from "./site";

const code = "num rounded bg-raised px-1.5 py-0.5 text-[0.9em] text-ink [overflow-wrap:anywhere]";

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is it really free?",
    a: (
      <p>
        Yes. DividendCase is open source under the AGPL-3.0-or-later licence, with no account, no subscription
        and no login. If a hosted DividendCase Cloud arrives later, the local app stays free.
      </p>
    ),
  },
  {
    q: "Where is my data stored?",
    a: (
      <>
        <p>In one SQLite file in your data folder, on your computer:</p>
        <ul className="mt-3 space-y-1.5">
          <li>
            macOS: <span className={code}>{DATA_FOLDERS.macos}</span>
          </li>
          <li>
            Windows: <span className={code}>{DATA_FOLDERS.windows}</span>
          </li>
          <li>
            Linux: <span className={code}>{DATA_FOLDERS.linux}</span>
          </li>
        </ul>
        <p className="mt-3">
          To back it up, quit the app and copy that folder. Set <span className={code}>DIVIDENDCASE_DATA_DIR</span>{" "}
          to use a different folder.
        </p>
      </>
    ),
  },
  {
    q: "Where does the market data come from?",
    a: (
      <p>
        Your computer fetches it from Yahoo Finance through the open-source yfinance library, for your own
        personal use. DividendCase never ships or distributes market data, and it isn&apos;t affiliated with
        Yahoo. While the app is open it refreshes your holdings and watchlist stocks when it starts and every
        day, and the screener&apos;s stocks every week, at about one stock a second, pausing whenever Yahoo asks.
        Exchange rates, for showing everything in your own currency, are the European Central Bank&apos;s
        daily reference rates.
      </p>
    ),
  },
  {
    q: "Which markets does it cover?",
    a: (
      <p>
        Stocks listed on NYSE, NASDAQ, LSE, Euronext Dublin, NSE, BSE, TSX and ASX, and ETFs such as SPY or VTI.
        The screener covers roughly 700 stocks: members of the S&amp;P 500, NIFTY 50, TSX 60, FTSE 100, ISEQ 20 and
        ASX 200, plus some high-yield groups.
      </p>
    ),
  },
  {
    q: "Do I need an account?",
    a: (
      <p>
        No. There&apos;s nothing to sign up for. The app runs at <span className={code}>{LOCAL_URL}</span>, which
        only your computer can reach, and nothing is sent to DividendCase.
      </p>
    ),
  },
  {
    q: "Does it work offline?",
    a: (
      <p>
        Your portfolios, holdings, watchlists and the data already fetched are on your computer, so you can open
        them without a connection. Fetching new prices and dividends needs the internet.
      </p>
    ),
  },
  {
    q: "Is this financial advice?",
    a: (
      <p>
        No. DividendCase shows data and calculations to help you keep track of your investments. Nothing in it,
        including the dividend safety score, is financial advice or a recommendation to buy or sell.
      </p>
    ),
  },
  {
    q: "I had an account on dividendcase.com. What happens now?",
    a: (
      <p>
        Hosted dividendcase.com accounts close on 1 November 2026. Before then, sign in to the old site, open
        Settings and export your portfolios to Excel. Then import that file into the app: your portfolios,
        holdings and watchlists come across.
      </p>
    ),
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t border-line py-24 sm:py-28">
      <div className="container-page grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">FAQ</p>
          <h2 id="faq-title" className="heading mt-4 text-[34px] sm:text-[44px]">
            Questions, <em className="serif-accent text-[1.1em]">answered</em>.
          </h2>
          <p className="mt-4 max-w-[380px] text-[17px] leading-[1.6] text-ink-2">
            Something else?{" "}
            <a
              href={`${GITHUB_URL}/issues`}
              className="text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink-2"
            >
              Open an issue on GitHub
            </a>{" "}
            and ask.
          </p>
        </div>

        <div className="divide-y divide-line border-y border-line">
          {FAQS.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-6 rounded-md py-5 text-[16.5px] font-medium tracking-[-0.01em] text-ink transition-colors hover:text-ink">
                {f.q}
                <span className="grid size-8 flex-none place-items-center rounded-full border border-line text-ink-3 transition-colors group-hover:border-line-strong group-hover:text-ink">
                  <ChevronDown
                    className="size-4 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </span>
              </summary>
              <div className="max-w-[640px] pb-6 text-[15.5px] leading-[1.65] text-ink-2">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
