"use client";

import { EChart } from "@/components/charts/EChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { chartColors } from "@/lib/chartTheme";
import { formatMoney } from "@/lib/format";
import type { DividendMetrics } from "@/lib/types";

interface Props {
  metrics: DividendMetrics;
}

const COLORS = {
  increase: chartColors.sprout,
  flat: chartColors.watch,
  decrease: chartColors.cut,
  partial: chartColors.lineStrong,
};

type Bar = { year: number; amount: number; color: string; label: string };

export function DividendStreakChart({ metrics }: Props) {
  const { annual_dividends, consecutive_growth_years } = metrics;
  if (!annual_dividends || Object.keys(annual_dividends).length < 2) return null;

  const currency = metrics.currency ?? "USD";
  const thisYear = new Date().getFullYear();
  const years = Object.keys(annual_dividends)
    .map(Number)
    .sort((a, b) => a - b);

  // The first year on record and the year in progress are partial: comparing them with a full
  // year would call an unfinished year a cut
  const bars: Bar[] = years.map((year, i) => {
    const amount = annual_dividends[String(year)];
    if (year === thisYear) return { year, amount, color: COLORS.partial, label: "so far this year" };
    if (i === 0) return { year, amount, color: COLORS.partial, label: "first year on record, may be partial" };
    const prev = annual_dividends[String(years[i - 1])];
    if (!prev) return { year, amount, color: COLORS.partial, label: "no year before to compare" };
    const change = ((amount - prev) / prev) * 100;
    const label = `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}% on ${years[i - 1]}`;
    if (change > 2) return { year, amount, color: COLORS.increase, label };
    if (change < -2) return { year, amount, color: COLORS.decrease, label };
    return { year, amount, color: COLORS.flat, label };
  });

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: { dataIndex: number }[]) => {
        const bar = bars[params[0].dataIndex];
        return `<b>${bar.year}</b><br/>${formatMoney(bar.amount, currency, { decimals: 4 })} a share<br/><span style="color:${chartColors.ink3}">${bar.label}</span>`;
      },
    },
    grid: { top: 16, right: 16, bottom: 8, left: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: bars.map((d) => String(d.year)),
      axisLabel: { interval: 0, rotate: years.length > 12 ? 45 : 0 },
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: (v: number) => formatMoney(v, currency, { decimals: 2 }) },
    },
    series: [
      {
        type: "bar",
        data: bars.map((d) => ({
          value: d.amount,
          itemStyle: d.color === COLORS.partial ? { color: "transparent", borderColor: chartColors.ink3, borderWidth: 1, borderType: "dashed" } : { color: d.color },
        })),
        barMaxWidth: 32,
      },
    ],
  };

  const streak = consecutive_growth_years ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Dividends by year</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
            {streak > 0 && (
              <span>
                Held or raised <span className="num text-ink">{streak}</span> {streak === 1 ? "year" : "years"} running
              </span>
            )}
            {streak >= 50 && <Badge variant="green">Dividend King</Badge>}
            {streak >= 25 && streak < 50 && <Badge variant="green">Dividend Aristocrat</Badge>}
            {streak >= 10 && streak < 25 && <Badge variant="outline">Dividend Achiever</Badge>}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ backgroundColor: COLORS.increase }} />Raised</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ backgroundColor: COLORS.flat }} />Flat, within 2%</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ backgroundColor: COLORS.decrease }} />Cut</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-dashed border-ink-3" />Partial year</span>
        </div>
      </CardHeader>
      <CardContent>
        <EChart option={option} style={{ height: 220 }} />
      </CardContent>
    </Card>
  );
}
