import {
  CalendarDays,
  ChartLine,
  ChartPie,
  Columns3,
  Layers,
  Repeat,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

type Feature = { icon: LucideIcon; title: string; body: string };

const FEATURES: Feature[] = [
  {
    icon: Layers,
    title: "Portfolios with real lots",
    body: "Up to 4 portfolios, each with individual purchase lots in any currency. Import and export them as Excel files.",
  },
  {
    icon: CalendarDays,
    title: "12-month income calendar",
    body: "The payments you can expect over the next year, projected from each holding's payment history.",
  },
  {
    icon: ChartPie,
    title: "Diversification",
    body: "Charts by sector, industry, country and payment frequency, plus a comparison against a benchmark index.",
  },
  {
    icon: Repeat,
    title: "DRIP calculator",
    body: "See how reinvesting your dividends could add up over the years.",
  },
  {
    icon: SlidersHorizontal,
    title: "Screener",
    body: "Roughly 700 stocks: members of the S&P 500, NIFTY 50, TSX 60, FTSE 100, ISEQ 20 and ASX 200, plus high-yield groups.",
  },
  {
    icon: Columns3,
    title: "Watchlists and compare",
    body: "Up to 4 watchlists, and side-by-side comparison of up to 4 stocks.",
  },
];

/* A sample 10-year payout history for the stock-page card (illustrative) */
const HISTORY = [1.28, 1.36, 1.44, 1.52, 1.6, 1.64, 1.68, 1.76, 1.84, 1.94];
const YEARS = ["'16", "'17", "'18", "'19", "'20", "'21", "'22", "'23", "'24", "'25"];

const SAFETY = [
  { label: "Safe", score: 82, tone: "text-sprout-hi", bar: "bg-sprout", icon: ShieldCheck },
  { label: "Moderate", score: 55, tone: "text-watch", bar: "bg-watch", icon: TriangleAlert },
  { label: "At risk", score: 24, tone: "text-cut", bar: "bg-cut", icon: TriangleAlert },
] as const;

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="py-24 sm:py-28">
      <div className="container-page">
        <div className="max-w-[640px]">
          <p className="eyebrow">Features</p>
          <h2 id="features-title" className="heading mt-4 text-[34px] sm:text-[44px]">
            The numbers behind every <em className="serif-accent text-[1.1em]">payout</em>.
          </h2>
          <p className="mt-4 text-[17px] leading-[1.6] text-ink-2">
            From one stock&apos;s payout record to your whole portfolio&apos;s next twelve months, in one app on
            your computer.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StockPageCard />
          <SafetyCard />
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-2xl border border-line bg-surface p-6 shadow-card">
              <span className="grid size-10 place-items-center rounded-xl border border-line bg-raised text-ink">
                <f.icon className="size-[18px]" aria-hidden />
              </span>
              <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.015em] text-ink">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-[1.6] text-ink-2">{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StockPageCard() {
  const max = Math.max(...HISTORY);
  return (
    <article className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-card md:col-span-2 md:flex-row md:items-center">
      <div className="md:max-w-[300px]">
        <span className="grid size-10 place-items-center rounded-xl border border-line bg-raised text-ink">
          <ChartLine className="size-[18px]" aria-hidden />
        </span>
        <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.015em] text-ink">Stock pages</h3>
        <p className="mt-2 text-[15px] leading-[1.6] text-ink-2">
          10 years of dividend history, TTM yield, dividend growth over 3, 5 and 10 years (CAGR) and growth
          streaks for every stock.
        </p>
      </div>

      <figure className="min-w-0 flex-1 rounded-xl border border-line bg-well p-4" aria-label="Sample chart: ten years of rising annual dividends">
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow">Dividends per share</p>
          <p className="eyebrow whitespace-nowrap">Sample</p>
        </div>
        <svg viewBox="0 0 300 96" className="mt-3 block h-auto w-full" aria-hidden="true" focusable="false">
          {HISTORY.map((v, i) => {
            const h = (v / max) * 74;
            return (
              <g key={YEARS[i]}>
                <rect
                  x={i * 30 + 3}
                  y={80 - h}
                  width={24}
                  height={h}
                  rx={3}
                  fill={i === HISTORY.length - 1 ? "#9bd96b" : "#7abf50"}
                  fillOpacity={i === HISTORY.length - 1 ? 1 : 0.7}
                />
                <text x={i * 30 + 15} y={94} textAnchor="middle" className="font-mono" fontSize="9" fill="#80809a">
                  {YEARS[i]}
                </text>
              </g>
            );
          })}
        </svg>
        <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
          {[
            ["TTM yield", "3.1%"],
            ["5-yr CAGR", "+5.4%"],
            ["Streak", "9 yrs"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12px] text-ink-3">{k}</dt>
              <dd className="num mt-0.5 text-[15px] text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </figure>
    </article>
  );
}

function SafetyCard() {
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card md:col-span-2 lg:col-span-1">
      <span className="grid size-10 place-items-center rounded-xl border border-line bg-raised text-ink">
        <ShieldCheck className="size-[18px]" aria-hidden />
      </span>
      <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.015em] text-ink">Dividend safety score</h3>
      <p className="mt-2 text-[15px] leading-[1.6] text-ink-2">
        A score from 0 to 100 on every stock page, to flag payouts worth a closer look.
      </p>
      <ul className="mt-5 space-y-2.5" aria-label="Sample safety scores">
        {SAFETY.map((s) => (
          <li key={s.label} className="grid grid-cols-[88px_1fr_28px] items-center gap-3 text-[13px]">
            <span className={`inline-flex items-center gap-1.5 ${s.tone}`}>
              <s.icon className="size-3.5" aria-hidden />
              {s.label}
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-raised">
              <span className={`block h-full rounded-full ${s.bar}`} style={{ width: `${s.score}%` }} />
            </span>
            <span className="num text-right text-ink">{s.score}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
