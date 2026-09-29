"use client";

import { ChevronDown, ShieldCheck, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatMoney, frequencyLabel } from "@/lib/format";
import type { DividendMetrics } from "@/lib/types";

interface Props {
  metrics: DividendMetrics | null;
  isLoading: boolean;
}

function Metric({
  label,
  value,
  sub,
  tip,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tip: React.ReactNode;
  tone?: "default" | "money";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-1.5">
        <p className="eyebrow truncate">{label}</p>
        <InfoTip>{tip}</InfoTip>
      </div>
      <p className={cn("num text-[26px] font-medium leading-none tracking-[-0.03em]", tone === "money" ? "text-money" : "text-ink")}>
        {value}
      </p>
      {sub && <p className="truncate text-[12.5px] text-ink-3">{sub}</p>}
    </div>
  );
}

function signed(v: number, decimals = 1) {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(decimals)}%`;
}

const SAFETY_TONE = {
  Safe: { text: "text-money", bar: "bg-sprout", badge: "green" as const },
  Moderate: { text: "text-watch", bar: "bg-watch", badge: "amber" as const },
  "At Risk": { text: "text-cut", bar: "bg-cut", badge: "destructive" as const },
};

export function MetricsPanel({ metrics, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[108px] rounded-xl" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const currency = metrics.currency ?? "USD";
  const freq = frequencyLabel(metrics.payment_frequency);
  const ppy = metrics.payments_per_year ?? 4;
  // TTM is the industry standard (as on Yahoo Finance and Morningstar); fall back to projected
  const primaryYield = metrics.ttm_yield ?? metrics.current_yield;
  const safetyLabel = (metrics.safety_label ?? "Moderate") as keyof typeof SAFETY_TONE;
  const safety = SAFETY_TONE[safetyLabel] ?? SAFETY_TONE.Moderate;
  const growthMain = metrics.dividend_growth_cagr_5y ?? metrics.dividend_growth_cagr_3y ?? null;
  const growthMainLabel = metrics.dividend_growth_cagr_5y != null ? "5 years" : "3 years";
  const streak = metrics.consecutive_growth_years;

  return (
    <div className="space-y-3">
      {/* Yield and payout */}
      <Card className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
        <Metric
          label="TTM yield"
          value={primaryYield != null ? `${primaryYield.toFixed(2)}%` : "—"}
          sub={metrics.avg_yield != null ? `Average ${metrics.avg_yield.toFixed(2)}% over this period` : "Last 12 months"}
          tone="money"
          tip={
            <>
              Dividends paid in the last 12 months ÷ the latest share price. The same yield Yahoo Finance and Morningstar show.
              <span className="mt-1 block font-mono text-[11px] text-ink-3">Σ last 12 months / last price × 100</span>
            </>
          }
        />
        <Metric
          label="Forward yield"
          value={metrics.current_yield != null ? `${metrics.current_yield.toFixed(2)}%` : "—"}
          sub="If the last payment continues"
          tip={
            <>
              The last payment × {ppy} payments a year ÷ the latest share price.
              <span className="mt-1 block font-mono text-[11px] text-ink-3">last dividend × {ppy} / last price × 100</span>
            </>
          }
        />
        <Metric
          label="Per share, a year"
          value={metrics.annual_dividend_estimate != null ? formatMoney(metrics.annual_dividend_estimate, currency, { decimals: 2 }) : "—"}
          sub={metrics.last_dividend_amount != null ? `Last paid ${formatMoney(metrics.last_dividend_amount, currency, { decimals: 4 })}` : undefined}
          tip={<>The last dividend × {ppy}: roughly what one share pays over the next year at today&apos;s rate.</>}
        />
        <Metric
          label="Pays"
          value={freq}
          sub={`${metrics.total_payments} payments on record`}
          tip={
            <>
              Worked out from the average gap between payment dates.
              {metrics.yield_consistency_score != null && (
                <> Yield consistency is {metrics.yield_consistency_score.toFixed(0)}/100 (100 = perfectly steady).</>
              )}
            </>
          }
        />
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Safety */}
        {metrics.dividend_safety_score != null && (
          <Card className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className={cn("size-4", safety.text)} />
              <p className="eyebrow">Dividend safety</p>
              <Badge variant={safety.badge} className="ml-auto">{metrics.safety_label}</Badge>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={cn("num text-[32px] font-medium leading-none tracking-[-0.03em]", safety.text)}>
                {metrics.dividend_safety_score.toFixed(0)}
              </span>
              <span className="num text-[13px] text-ink-3">/ 100</span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden="true">
              <div className={cn("h-full rounded-full", safety.bar)} style={{ width: `${Math.min(100, Math.max(0, metrics.dividend_safety_score))}%` }} />
              <span className="absolute inset-y-0 left-[40%] w-px bg-ground/80" />
              <span className="absolute inset-y-0 left-[70%] w-px bg-ground/80" />
            </div>
            <details className="group text-[12px] text-ink-3">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
                How it&apos;s scored
                <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-2 space-y-1 leading-snug">
                <li><span className="num text-ink-2">40%</span> yield consistency, (1 − σ/μ) × 100</li>
                <li><span className="num text-ink-2">25%</span> growth streak, capped at 10 years</li>
                <li><span className="num text-ink-2">15%</span> history length, capped at 10 years</li>
                <li><span className="num text-ink-2">10%</span> no cuts in the last 5 years</li>
                <li><span className="num text-ink-2">10%</span> yield below 8% (half marks to 15%)</li>
                <li className="pt-1">Safe from 70 · Moderate from 40 · At risk below 40</li>
              </ul>
            </details>
          </Card>
        )}

        {/* Growth */}
        {growthMain != null && (
          <Card className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              {growthMain >= 0 ? <TrendingUp className="size-4 text-money" /> : <TrendingDown className="size-4 text-cut" />}
              <p className="eyebrow">Dividend growth</p>
              <InfoTip>Compound annual growth of the dividend per share: (end ÷ start)^(1 ÷ years) − 1.</InfoTip>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("num text-[32px] font-medium leading-none tracking-[-0.03em]", growthMain >= 0 ? "text-money" : "text-cut")}>
                {signed(growthMain)}
              </span>
              <span className="text-[13px] text-ink-3">a year, {growthMainLabel}</span>
            </div>
            <div className="mt-auto grid grid-cols-3 gap-2">
              {([["3Y", metrics.dividend_growth_cagr_3y], ["5Y", metrics.dividend_growth_cagr_5y], ["10Y", metrics.dividend_growth_cagr_10y]] as const).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-well px-2.5 py-2">
                  <p className="font-mono text-[10.5px] text-ink-3">{k}</p>
                  <p className={cn("num text-[13.5px]", v == null ? "text-ink-3" : v >= 0 ? "text-ink" : "text-cut")}>
                    {v == null ? "—" : `${v >= 0 ? "▲" : "▼"} ${signed(v)}`}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Streak */}
        {streak != null && (
          <Card className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Trophy className={cn("size-4", streak >= 10 ? "text-money" : "text-ink-3")} />
              <p className="eyebrow">Growth streak</p>
              <InfoTip>Consecutive years with a stable or higher total dividend, counting back from the latest full year (2% tolerance for “flat”).</InfoTip>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("num text-[32px] font-medium leading-none tracking-[-0.03em]", streak >= 10 ? "text-money" : "text-ink")}>{streak}</span>
              <span className="text-[13px] text-ink-3">{streak === 1 ? "year" : "years"} in a row</span>
            </div>
            <div className="mt-auto">
              {streak >= 50 ? (
                <Badge variant="green">Dividend King · 50+ years</Badge>
              ) : streak >= 25 ? (
                <Badge variant="green">Dividend Aristocrat · 25+ years</Badge>
              ) : streak >= 10 ? (
                <Badge variant="green">Held or raised every year on record</Badge>
              ) : (
                <p className="text-[12px] text-ink-3">Counted within the stored history, which goes back up to 10 years.</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
