"use client";

import { useMemo } from "react";
import { EChart } from "@/components/charts/EChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/tooltip";
import { chartColors } from "@/lib/chartTheme";
import {
  exDividendMoves, linearFit, mean, median, pearson, yearByYear, yieldThenReturn,
  type Dividend,
} from "@/lib/indicators";
import { cn } from "@/lib/utils";
import type { PriceBar } from "@/lib/types";

interface Props {
  /** Daily bars, the whole stored history */
  bars: PriceBar[];
  dividends: Dividend[];
  ticker: string;
}

function signed(v: number, decimals = 1) {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(decimals)}%`;
}

/** How strong a correlation is, in words. */
function strength(r: number): string {
  const a = Math.abs(r);
  if (a < 0.2) return "barely related";
  if (a < 0.4) return r > 0 ? "loosely related, moving the same way" : "loosely related, moving opposite ways";
  if (a < 0.7) return r > 0 ? "moderately related, moving the same way" : "moderately related, moving opposite ways";
  return r > 0 ? "closely related, moving the same way" : "closely related, moving opposite ways";
}

function Figure({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "money" | "cut" }) {
  return (
    <div className="glass-well min-w-0 rounded-xl border px-3 py-2.5">
      <p className="text-[12px] leading-snug text-ink-3">{label}</p>
      <p className={cn("num mt-0.5 text-[18px] font-medium tracking-[-0.02em]", tone === "money" ? "text-money" : tone === "cut" ? "text-cut" : "text-ink")}>{value}</p>
      {sub && <p className="text-[11.5px] leading-snug text-ink-3">{sub}</p>}
    </div>
  );
}

const axisPct = { axisLabel: { formatter: (v: number) => `${v}%` } };

/** Three looks at how a stock's dividends and its price have moved together. */
export function DividendAnalysis({ bars, dividends, ticker }: Props) {
  const moves = useMemo(() => exDividendMoves(bars, dividends), [bars, dividends]);
  const years = useMemo(() => yearByYear(bars, dividends), [bars, dividends]);
  const points = useMemo(() => yieldThenReturn(bars, dividends), [bars, dividends]);

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <ExDividendCard moves={moves} ticker={ticker} />
      <GrowthCard years={years} />
      <YieldReturnCard points={points} ticker={ticker} />
    </div>
  );
}

function ExDividendCard({ moves, ticker }: { moves: ReturnType<typeof exDividendMoves>; ticker: string }) {
  if (moves.length < 4) {
    return (
      <Card>
        <CardHeader><CardTitle>Around ex-dividend dates</CardTitle></CardHeader>
        <CardContent><p className="text-[13px] text-ink-3">Fewer than four ex-dividend dates fall inside the stored prices for {ticker}.</p></CardContent>
      </Card>
    );
  }
  const avgDiv = mean(moves.map((m) => m.dividendPct));
  const avgDrop = mean(moves.map((m) => m.drop));
  const recovered = moves.filter((m) => m.recoveryDays != null && m.recoveryDays <= 20).length;
  const days = median(moves.filter((m) => m.recoveryDays != null).map((m) => m.recoveryDays!));
  // The dashed line is where the price fell by exactly the dividend; keep it in view
  const lo = Math.min(...moves.map((m) => m.dividendPct)) * 0.8;
  const hi = Math.max(...moves.map((m) => m.dividendPct)) * 1.15;

  const option = {
    grid: { top: 12, right: 12, bottom: 34, left: 8, containLabel: true },
    tooltip: {
      trigger: "item",
      formatter: (p: { dataIndex: number }) => {
        const m = moves[p.dataIndex];
        if (!m) return "";
        const back = m.recoveryDays == null ? "not back within a year" : m.recoveryDays === 0 ? "back the same day" : `back in ${m.recoveryDays} trading days`;
        return `${new Date(`${m.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}<br/>Dividend ${m.dividendPct.toFixed(2)}% of the price<br/>Opened ${signed(m.drop, 2)}, ${back}`;
      },
    },
    xAxis: { type: "value", name: "Dividend, % of price", nameLocation: "middle", nameGap: 22, min: Number(lo.toFixed(2)), max: Number(hi.toFixed(2)), axisLabel: { formatter: (v: number) => `${v.toFixed(1)}%` } },
    yAxis: {
      type: "value",
      min: (v: { min: number }) => Number(Math.min(v.min, -hi).toFixed(1)) - 0.1,
      max: (v: { max: number }) => Number(Math.max(v.max, 0).toFixed(1)) + 0.1,
      axisLabel: { formatter: (v: number) => `${v.toFixed(1)}%` },
    },
    series: [
      {
        type: "scatter",
        symbolSize: 7,
        data: moves.map((m) => ({
          value: [m.dividendPct, m.drop],
          itemStyle: { color: m.drop > -m.dividendPct ? chartColors.sprout : chartColors.ink3, opacity: 0.85 },
        })),
      },
      {
        // Drawn as a line of its own: a markLine between two coordinates didn't show on real data
        type: "line",
        silent: true,
        symbol: "none",
        data: [[lo, -lo], [hi, -hi]],
        lineStyle: { color: chartColors.ink3, type: "dashed", width: 1 },
        endLabel: { show: true, formatter: "Fell by the dividend", color: chartColors.ink3, fontSize: 10, offset: [-118, 12] },
        tooltip: { show: false },
      },
    ],
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle>Around ex-dividend dates</CardTitle>
          <InfoTip>
            On the ex-dividend date the price usually opens lower by about the dividend, since new buyers won&apos;t get it. Each
            dot is one payment: its size against the price, and how the price opened against the close before. Dots above the
            dashed line fell by less than the dividend.
          </InfoTip>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Figure label="Average dividend" value={`${avgDiv.toFixed(2)}%`} sub="Of the price the day before" />
          <Figure label="Average move at the open" value={signed(avgDrop, 2)} sub={`On ${moves.length} ex-dividend dates`} />
          <Figure
            label="Back within 20 trading days"
            value={`${Math.round((recovered / moves.length) * 100)}%`}
            sub="Closed at or above the day before"
          />
          <Figure label="Typical time to get back" value={days == null ? "—" : `${days} ${days === 1 ? "day" : "days"}`} sub="Median, in trading days" />
        </div>
        <EChart option={option} style={{ height: 210 }} />
      </CardContent>
    </Card>
  );
}

function GrowthCard({ years }: { years: ReturnType<typeof yearByYear> }) {
  const full = years.filter((y) => !y.partial && y.dividendGrowth != null);
  const r = pearson(full.map((y) => y.dividendGrowth!), full.map((y) => y.priceReturn));
  const shown = years.filter((y) => y.dividendGrowth != null || !y.partial);

  const option = {
    grid: { top: 12, right: 8, bottom: 30, left: 8, containLabel: true },
    legend: { data: ["Dividend growth", "Price change"], bottom: 0 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number | null) => (v == null ? "—" : signed(v)),
    },
    xAxis: { type: "category", data: shown.map((y) => (y.partial ? `${y.year} so far` : String(y.year))), axisLabel: { interval: 0, rotate: shown.length > 8 ? 40 : 0 } },
    yAxis: { type: "value", ...axisPct },
    series: [
      { name: "Dividend growth", type: "bar", data: shown.map((y) => y.dividendGrowth), itemStyle: { color: chartColors.sprout }, barMaxWidth: 12 },
      { name: "Price change", type: "bar", data: shown.map((y) => y.priceReturn), itemStyle: { color: chartColors.ink3 }, barMaxWidth: 12 },
    ],
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle>Dividend growth and the price</CardTitle>
          <InfoTip>
            Each full calendar year: how much more (or less) the dividends paid that year came to than the year before, next to
            how the price moved from one year-end close to the next. The correlation is worked out over the full years only.
          </InfoTip>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {full.length < 4 || r == null ? (
          <p className="text-[13px] text-ink-3">At least four full years with dividends in both years are needed to compare them.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Figure label="Correlation" value={r.toFixed(2)} sub={`Over ${full.length} full years`} />
              <Figure
                label="Average a year"
                value={signed(mean(full.map((y) => y.dividendGrowth!)))}
                sub={`Dividends, against ${signed(mean(full.map((y) => y.priceReturn)))} price`}
              />
            </div>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              Year by year, dividend growth and the price have been <span className="text-ink">{strength(r)}</span>.
            </p>
          </>
        )}
        <EChart option={option} style={{ height: 220 }} />
      </CardContent>
    </Card>
  );
}

function YieldReturnCard({ points, ticker }: { points: ReturnType<typeof yieldThenReturn>; ticker: string }) {
  if (points.length < 20) {
    return (
      <Card>
        <CardHeader><CardTitle>Yield, then the year after</CardTitle></CardHeader>
        <CardContent><p className="text-[13px] text-ink-3">{ticker} needs about two years of prices and dividends for this.</p></CardContent>
      </Card>
    );
  }
  const xs = points.map((p) => p.yield);
  const ys = points.map((p) => p.forward);
  const r = pearson(xs, ys);
  const fit = linearFit(xs, ys);
  const sorted = [...points].sort((a, b) => a.yield - b.yield);
  const third = Math.floor(sorted.length / 3);
  const groups = [sorted.slice(0, third), sorted.slice(third, sorted.length - third), sorted.slice(sorted.length - third)];
  const [low, , high] = groups.map((g) => ({ yieldFrom: g[0].yield, yieldTo: g[g.length - 1].yield, forward: mean(g.map((p) => p.forward)) }));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  const option = {
    grid: { top: 12, right: 12, bottom: 34, left: 8, containLabel: true },
    tooltip: {
      trigger: "item",
      formatter: (p: { seriesName: string; dataIndex: number }) => {
        if (p.seriesName !== "Weeks") return "";
        const pt = points[p.dataIndex];
        return `${new Date(`${pt.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}<br/>Yield ${pt.yield.toFixed(2)}%<br/>Next 12 months ${signed(pt.forward)}`;
      },
    },
    xAxis: { type: "value", name: "Trailing yield", nameLocation: "middle", nameGap: 22, scale: true, ...axisPct },
    yAxis: { type: "value", name: "Return, next 12 months", nameTextStyle: { align: "left" }, ...axisPct },
    series: [
      {
        name: "Weeks",
        type: "scatter",
        symbolSize: 4,
        data: points.map((p) => [p.yield, p.forward]),
        itemStyle: { color: chartColors.s3, opacity: 0.55 },
      },
      ...(fit
        ? [{
            name: "Trend",
            type: "line",
            symbol: "none",
            silent: true,
            data: [[minX, fit.intercept + fit.slope * minX], [maxX, fit.intercept + fit.slope * maxX]],
            lineStyle: { color: chartColors.sprout, width: 1.5 },
          }]
        : []),
    ],
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle>Yield, then the year after</CardTitle>
          <InfoTip>
            One dot a week: the trailing yield that week, and the total return (price plus dividends) over the following 12
            months. Neighbouring weeks share most of their following year, so read the trend as a tendency in this stock&apos;s
            past, not as proof.
          </InfoTip>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Figure
            label={`Yield ${high.yieldFrom.toFixed(1)}% or more`}
            value={signed(high.forward)}
            sub="Average return the year after"
            tone={high.forward >= 0 ? "money" : "cut"}
          />
          <Figure
            label={`Yield ${low.yieldTo.toFixed(1)}% or less`}
            value={signed(low.forward)}
            sub="Average return the year after"
            tone={low.forward >= 0 ? "money" : "cut"}
          />
        </div>
        {r != null && (
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            The starting yield and the next year&apos;s return have been <span className="text-ink">{strength(r)}</span>{" "}
            (correlation <span className="num">{r.toFixed(2)}</span>).
          </p>
        )}
        <EChart option={option} style={{ height: 210 }} />
      </CardContent>
    </Card>
  );
}
