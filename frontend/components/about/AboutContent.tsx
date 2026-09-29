"use client";

import Link from "next/link";
import {
  BarChart3,
  Bookmark,
  CalendarDays,
  ExternalLink,
  FileSpreadsheet,
  GitCompareArrows,
  Layers,
  Lock,
  ShieldAlert,
  SlidersHorizontal,
  Sprout,
} from "lucide-react";
import { LogoMark } from "@dividendcase/brand/logo";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

const GITHUB_URL = "https://github.com/dividendcase/dividendcase";

const features = [
  { Icon: BarChart3, title: "Stock pages", text: "Ten years of dividends, TTM yield, a safety score, dividend growth and growth streaks for any stock Yahoo Finance knows." },
  { Icon: Layers, title: "Holdings", text: "Every purchase as its own lot, in any currency, with value, dividends received and a benchmark comparison." },
  { Icon: CalendarDays, title: "Income calendar", text: "The next 12 months of expected dividends, month by month." },
  { Icon: SlidersHorizontal, title: "Screener", text: "Dividend payers from the S&P 500, NIFTY 50, TSX 60, FTSE 100, ISEQ 20, ASX 200 and high-yield groups." },
  { Icon: Bookmark, title: "Watchlists", text: "Up to four lists of stocks you're keeping an eye on." },
  { Icon: GitCompareArrows, title: "Compare", text: "Up to four stocks side by side." },
  { Icon: Sprout, title: "DRIP calculator", text: "What reinvesting dividends does over the years." },
  { Icon: FileSpreadsheet, title: "Excel in and out", text: "Import purchases from a spreadsheet, export everything, or download a report." },
];

const methodology: { term: string; body: React.ReactNode }[] = [
  {
    term: "TTM yield",
    body: (
      <>
        Dividends paid in the last 12 months divided by the latest price, as a percentage. The latest price is the share price
        on the most recent dividend date. <em>Projected yield</em> instead takes the latest payment times the number of
        payments a year.
      </>
    ),
  },
  {
    term: "Payment frequency",
    body: (
      <>
        Worked out from the average gap between payments: under <span className="num">45</span> days is monthly, under{" "}
        <span className="num">120</span> quarterly, under <span className="num">270</span> half-yearly, otherwise yearly.
      </>
    ),
  },
  {
    term: "Dividend growth (CAGR)",
    body: (
      <>
        The compound yearly growth of the total dividend per share over <span className="num">3</span>,{" "}
        <span className="num">5</span> and <span className="num">10</span> years, ending with the last full year. The current
        year is left out because it isn&apos;t finished.
      </>
    ),
  },
  {
    term: "Growth streak",
    body: (
      <>
        Full years in a row in which the yearly dividend was at least <span className="num">98%</span> of the year before. The{" "}
        <span className="num">2%</span> tolerance stops small currency or rounding dips from breaking a streak.
      </>
    ),
  },
  {
    term: "Consistency score",
    body: (
      <>
        <span className="num">0</span> to <span className="num">100</span>: how steady the yield of each payment has been.
        It is <span className="num">100 × (1 − coefficient of variation)</span>, so a yield that barely moves scores close to{" "}
        <span className="num">100</span>.
      </>
    ),
  },
  {
    term: "Safety score",
    body: (
      <>
        <span className="num">0</span> to <span className="num">100</span>, built from five parts:
        <ul className="mt-2 space-y-1">
          {[
            ["40%", "consistency score"],
            ["25%", "growth streak, full marks at 10 years"],
            ["15%", "length of history, full marks at 10 years of data"],
            ["10%", "no cuts in the last five full years (a cut is a drop of more than 5%; one cut gives half marks)"],
            ["10%", "yield level: full marks under 8%, half under 15%, none above, since very high yields are often cut"],
          ].map(([w, t]) => (
            <li key={w + t} className="flex gap-3">
              <span className="num w-9 shrink-0 text-ink">{w}</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <span className="mt-2 block">
          <span className="num">70</span> and above is labelled Safe, <span className="num">40</span> to{" "}
          <span className="num">69</span> Moderate, below <span className="num">40</span> At risk.
        </span>
      </>
    ),
  },
  {
    term: "Income calendar",
    body: (
      <>
        Each stock&apos;s next payments are projected from its last payment date and frequency. The amount is your shares times
        the last dividend per share, so a raise or a cut shows up after it is paid.
      </>
    ),
  },
  {
    term: "Holdings and benchmark",
    body: (
      <>
        Holdings are valued at the price on each stock&apos;s latest dividend date. The benchmark line puts the same total
        into the market&apos;s index (the S&amp;P 500 for US stocks, for example) from the year of your first purchase, and
        counts its dividends too. Amounts in different currencies are never converted.
      </>
    ),
  },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">{children}</h2>;
}

export function AboutContent() {
  return (
    <div className="max-w-3xl space-y-10">
      <PageHeader title="About" description="A free, open-source dividend tracker that runs on your own computer." />

      {/* What it is */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <p className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
            <span className="text-sprout">Dividend</span>Case
          </p>
        </div>
        <div className="space-y-3 text-[14.5px] leading-7 text-ink-2">
          <p>
            DividendCase helps you follow the dividends your investments pay: what came in, what&apos;s coming next, and how
            safe and fast-growing each payer is. It is built for people who invest for income and want their records in
            their own hands.
          </p>
          <p>
            There is no account and no server of ours in the middle. The app runs on this computer, keeps everything in one
            file here, and fetches market data straight from Yahoo Finance.
          </p>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-raised px-4 py-3 text-[13px] text-ink-2">
          <Lock className="mt-0.5 size-4 shrink-0 text-sprout" />
          <p>
            Your holdings, watchlists and settings never leave this computer. The only requests the app makes are for
            market data, and they come from here.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="space-y-4">
        <SectionTitle>What it does</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {features.map(({ Icon, title, text }) => (
            <div key={title} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
              <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
              <div className="space-y-1">
                <h3 className="text-[13.5px] font-medium text-ink">{title}</h3>
                <p className="text-[12.5px] leading-relaxed text-ink-3">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Methodology */}
      <section className="space-y-4">
        <SectionTitle>How the numbers are worked out</SectionTitle>
        <p className="text-[14px] leading-7 text-ink-2">
          Every figure is calculated on this computer from the dividend history and prices stored here.
        </p>
        <Card>
          <dl className="divide-y divide-line">
            {methodology.map(({ term, body }) => (
              <div key={term} className="grid gap-1.5 px-4 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6 sm:px-5">
                <dt className="text-[13.5px] font-medium text-ink">{term}</dt>
                <dd className="text-[13.5px] leading-relaxed text-ink-2">{body}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>

      {/* Data source */}
      <section className="space-y-4">
        <SectionTitle>Where the data comes from</SectionTitle>
        <div className="space-y-3 text-[14px] leading-7 text-ink-2">
          <p>
            Prices, dividends and company details come from Yahoo Finance through the open-source{" "}
            <a href="https://github.com/ranaroussi/yfinance" target="_blank" rel="noopener noreferrer" className="text-sprout underline-offset-4 hover:underline">
              yfinance
            </a>{" "}
            library. Your computer fetches them for your own use; DividendCase never ships or shares market data, so every
            installation collects its own.
          </p>
          <p>
            While the app is open it keeps data current in the background: your holdings and watchlist stocks when it starts
            and every day, and the screener&apos;s stocks every week, about one stock a second, pausing whenever Yahoo Finance
            asks it to. The{" "}
            <Link href="/dashboard/data/" className="text-sprout underline-offset-4 hover:underline">
              Data page
            </Link>{" "}
            shows progress.
          </p>
        </div>
        <Card className="border-watch/30 bg-watch/5">
          <CardContent className="flex gap-3 pt-4 sm:pt-5">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-watch" />
            <div className="space-y-1.5">
              <h3 className="text-[13.5px] font-semibold text-ink">Not financial advice</h3>
              <p className="text-[13px] leading-relaxed text-ink-2">
                DividendCase is for information only. Past dividends don&apos;t guarantee future ones, projections are
                estimates, and data from Yahoo Finance can be late or wrong. DividendCase is not affiliated with Yahoo. Do
                your own research, and speak to a qualified adviser before making investment decisions.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Open source */}
      <section className="space-y-4">
        <SectionTitle>Open source</SectionTitle>
        <div className="space-y-3 text-[14px] leading-7 text-ink-2">
          <p>
            DividendCase is free software under the{" "}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sprout underline-offset-4 hover:underline"
            >
              GNU AGPL, version 3 or later
            </a>
            . You can read the code, change it and share it under the same terms. The DividendCase name and logo are not
            covered by the licence.
          </p>
        </div>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
        >
          <span className="min-w-0">
            <span className="block text-[13.5px] font-medium text-ink">Source code, issues and releases</span>
            <span className="num block truncate text-[12.5px] text-ink-3">github.com/dividendcase/dividendcase</span>
          </span>
          <ExternalLink className="size-4 shrink-0 text-ink-3 transition-colors group-hover:text-ink" />
        </a>
      </section>

      {/* Maker */}
      <section className="space-y-3 border-t border-line pt-8">
        <SectionTitle>Who makes it</SectionTitle>
        <div className="space-y-3 text-[14px] leading-7 text-ink-2">
          <p>
            <span className="text-ink">Pratik Barve</span>, a data engineer and Python developer. With a background in
            physics, astronomy and data science, he enjoys diving deep into complex topics, runs computational physics and
            astronomy workshops, and is an avid stargazer.
          </p>
          <p>
            <a href="https://pratikbarve.com" target="_blank" rel="noopener noreferrer" className="text-sprout underline-offset-4 hover:underline">
              pratikbarve.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
