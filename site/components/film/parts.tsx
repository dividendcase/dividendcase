import { ArrowRight } from "@phosphor-icons/react/ssr";
import { GITHUB_URL, buttonPrimary } from "../site";
import { CHART_MAX, MONTHS, RATES, type ExampleHolding } from "./example";

/** The hero's words: a headline, one sentence and the two links. */
export function HeroCopy() {
  return (
    <div className="max-w-[640px]">
      <h1 id="hero-title" className="heading text-[clamp(40px,5.1vw,72px)] leading-[1.03] tracking-[-0.04em]">
        See what your dividends <span className="text-sprout">really</span> pay.
      </h1>
      <p className="mt-5 max-w-[520px] text-[17px] leading-[1.6] text-pretty text-ink-2 sm:text-[19px]">
        Track dividend income from New York to Mumbai, after tax and in your currency. Free, open source, on your
        computer.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
        <a
          href="#install"
          className={`${buttonPrimary} px-5 py-3 text-[15px] shadow-[0_10px_30px_-12px_rgb(122_191_80/0.55)] active:translate-y-px`}
        >
          Install for free
          <ArrowRight weight="bold" className="size-4" aria-hidden />
        </a>
        <a
          href={GITHUB_URL}
          className="border-b border-line-strong pb-0.5 text-[15px] font-medium text-ink transition-colors hover:border-ink-3"
        >
          View on GitHub
        </a>
      </div>
    </div>
  );
}

/** A holding as the app's portfolio list shows it: badge, name, exchange, currency and shares. */
export function HoldingCard({ holding, ...rest }: { holding: ExampleHolding } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3 py-2.5 shadow-[0_24px_40px_-22px_rgb(0_0_0/0.8)] md:gap-3.5 md:px-4 md:py-3.5"
    >
      <span className="grid size-9 flex-none place-items-center rounded-[10px] border border-line-strong bg-raised font-mono text-[11px] font-semibold text-ink md:size-11 md:text-[12px]">
        {holding.badge}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink md:text-[15px]">{holding.name}</span>
        <span className="mt-0.5 flex gap-2.5 truncate font-mono text-[11px] text-ink-3 md:text-[12px]">
          <span className="truncate">{holding.exchange}</span>
          <span>{holding.currency}</span>
        </span>
      </span>
      <span className="hidden text-right sm:block">
        <span className="num block text-[15px] text-ink md:text-[16px]">{holding.shares}</span>
        <span className="text-[11px] text-ink-3">shares</span>
      </span>
    </div>
  );
}

/**
 * The 12-month income chart. Each column is the month's income before tax; its top part (`data-wcap`)
 * is the tax kept at source. `afterTax` draws that part lifted off and outlined, for the still version.
 */
export function IncomeChart({ afterTax = false }: { afterTax?: boolean }) {
  return (
    <div>
      <div className="flex h-[30vh] items-end md:h-[34vh]">
        {MONTHS.map((m, i) => (
          <div key={`${m.month}-${i}`} className="flex h-full flex-1 items-end justify-center">
            <div
              data-bar=""
              className="relative flex w-[clamp(14px,4.1vw,58px)] origin-bottom flex-col"
              style={{ height: `${(m.gross / CHART_MAX) * 100}%` }}
            >
              {m.label && (
                <span
                  data-taxlabel=""
                  className={`absolute bottom-full left-1/2 mb-6 hidden -translate-x-1/2 font-mono text-[12px] whitespace-nowrap text-ink-2 md:block ${afterTax ? "" : "invisible opacity-0"}`}
                >
                  {m.label}
                  <span className="absolute top-full left-1/2 mt-1 block h-3.5 w-px bg-vault-face" />
                </span>
              )}
              <div
                data-wcap=""
                className="relative w-full flex-none"
                style={{ height: `${(m.withheld / m.gross) * 100}%`, transform: afterTax ? "translateY(-12px)" : undefined }}
              >
                <div data-wsolid="" className={`absolute inset-0 rounded-t-[9px] bg-sprout ${afterTax ? "opacity-0" : ""}`} />
                <div
                  data-whatch=""
                  className={`absolute inset-0 rounded-t-[9px] border border-dashed border-vault-face bg-[repeating-linear-gradient(135deg,rgb(128_128_154/0.3)_0_2px,transparent_2px_7px)] ${afterTax ? "" : "opacity-0"}`}
                />
              </div>
              <div className="w-full flex-1 rounded-b-[3px] bg-gradient-to-b from-sprout to-leaf" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-px bg-line" />
      <div data-months="" className="mt-3 flex font-mono text-[10px] text-ink-3 md:text-[12px]">
        {MONTHS.map((m, i) => (
          <span key={`${m.month}-${i}`} className="flex-1 text-center">
            <span className="md:hidden">{m.month[0]}</span>
            <span className="hidden md:inline">{m.month}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** What each country keeps, for the film's tax residence */
export function RateChips({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-1.5 font-mono text-[11px] text-ink-2 md:text-[12px] ${className}`}>
      {RATES.map((r) => (
        <li key={r} className="rounded-md border border-line px-2 py-1">
          {r}
        </li>
      ))}
    </ul>
  );
}
