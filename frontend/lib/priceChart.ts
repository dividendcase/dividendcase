/**
 * Building blocks for price charts (the screener's preview and Advanced charts): the price drawn
 * as a line, area, candles or OHLC bars, the volume under it, and the labels around them.
 */
import { chartColors } from "@/lib/chartTheme";
import { formatMoney } from "@/lib/format";
import type { Interval } from "@/lib/indicators";
import type { PriceBar } from "@/lib/types";

export type ChartType = "line" | "area" | "candles" | "bars";

export const CHART_TYPES: readonly { value: ChartType; label: string; title: string }[] = [
  { value: "line", label: "Line", title: "The closing price each day" },
  { value: "area", label: "Area", title: "The closing price, filled below" },
  { value: "candles", label: "Candles", title: "Open, high, low and close: the body runs from open to close" },
  { value: "bars", label: "Bars", title: "Open, high, low and close: ticks for the open (left) and close (right)" },
];

/** Months of history; null is everything stored (up to ten years) */
export const RANGES: readonly { value: number; label: string }[] = [
  { value: 1, label: "1M" },
  { value: 3, label: "3M" },
  { value: 6, label: "6M" },
  { value: 12, label: "1Y" },
  { value: 60, label: "5Y" },
  { value: 120, label: "10Y" },
];

export const UP = chartColors.sprout;
export const DOWN = chartColors.cut;

export function rangeLabel(months: number): string {
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.round(months / 12);
  return `${years} ${years === 1 ? "year" : "years"}`;
}

/** Axis labels: days for short ranges, months and years for long ones. */
export function dateLabel(iso: string, interval: Interval, long = false): string {
  const d = new Date(`${iso}T00:00:00`);
  if (interval === "day" && !long) return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** The price series in the chosen style. Lines and areas take the colour of the move over the range. */
export function priceSeries(
  type: ChartType,
  bars: PriceBar[],
  opts: { color: string; xAxisIndex?: number; yAxisIndex?: number; name?: string }
): Record<string, unknown> {
  const axes = { xAxisIndex: opts.xAxisIndex ?? 0, yAxisIndex: opts.yAxisIndex ?? 0 };
  const name = opts.name ?? "Price";
  if (type === "candles") {
    return {
      name,
      type: "candlestick",
      ...axes,
      data: bars.map((b) => [b.open ?? b.close, b.close, b.low ?? b.close, b.high ?? b.close]),
      itemStyle: { color: UP, color0: DOWN, borderColor: UP, borderColor0: DOWN, borderWidth: 1 },
      barMaxWidth: 14,
    };
  }
  if (type === "bars") {
    return {
      name,
      type: "custom",
      ...axes,
      data: bars.map((b, i) => [i, b.open ?? b.close, b.close, b.low ?? b.close, b.high ?? b.close]),
      encode: { x: 0, y: [1, 2, 3, 4] },
      renderItem: (_: unknown, api: OhlcApi) => {
        const i = api.value(0);
        const [open, close, low, high] = [api.value(1), api.value(2), api.value(3), api.value(4)];
        const o = api.coord([i, open]);
        const c = api.coord([i, close]);
        const l = api.coord([i, low]);
        const h = api.coord([i, high]);
        const tick = Math.max(1.5, Math.min(6, api.size([1, 0])[0] * 0.35));
        const style = { stroke: close >= open ? UP : DOWN, lineWidth: 1.25 };
        return {
          type: "group",
          children: [
            { type: "line", shape: { x1: l[0], y1: l[1], x2: h[0], y2: h[1] }, style },
            { type: "line", shape: { x1: o[0] - tick, y1: o[1], x2: o[0], y2: o[1] }, style },
            { type: "line", shape: { x1: c[0], y1: c[1], x2: c[0] + tick, y2: c[1] }, style },
          ],
        };
      },
    };
  }
  return {
    name,
    type: "line",
    ...axes,
    data: bars.map((b) => b.close),
    symbol: "none",
    lineStyle: { color: opts.color, width: 1.75 },
    itemStyle: { color: opts.color },
    ...(type === "area" ? { areaStyle: { color: opts.color, opacity: 0.09 } } : {}),
  };
}

interface OhlcApi {
  value: (dim: number) => number;
  coord: (point: [number, number]) => [number, number];
  size: (value: [number, number]) => [number, number];
}

/** Volume bars, tinted by whether the price closed up or down that day. */
export function volumeSeries(bars: PriceBar[], axes: { xAxisIndex: number; yAxisIndex: number }): Record<string, unknown> {
  return {
    name: "Volume",
    type: "bar",
    ...axes,
    data: bars.map((b, i) => ({
      value: b.volume ?? 0,
      itemStyle: { color: b.close >= (bars[i - 1]?.close ?? b.open ?? b.close) ? "rgba(122,191,80,0.38)" : "rgba(229,96,79,0.38)" },
    })),
    barMaxWidth: 10,
    itemStyle: { borderRadius: 0 },
  };
}

export function compactNumber(n: number): string {
  return n.toLocaleString("en", { notation: "compact", maximumFractionDigits: 1 });
}

/** The tooltip's first lines for one bar. */
export function barTooltip(bar: PriceBar, currency: string, interval: Interval): string {
  const when =
    interval === "day"
      ? new Date(`${bar.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : `${interval === "week" ? "Week to" : "Month to"} ${new Date(`${bar.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  const money = (v: number | null) => (v == null ? "—" : formatMoney(v, currency, { decimals: 2 }));
  const row = (label: string, value: string) =>
    `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${chartColors.ink3}">${label}</span><span style="font-variant-numeric:tabular-nums">${value}</span></div>`;
  return (
    `<div style="margin-bottom:4px;color:${chartColors.ink}">${when}</div>` +
    row("Open", money(bar.open)) +
    row("High", money(bar.high)) +
    row("Low", money(bar.low)) +
    row("Close", money(bar.close)) +
    (bar.volume ? row("Volume", compactNumber(bar.volume)) : "")
  );
}

/** The message from an API error ("API 503: {"detail": "..."}"), for showing as it is. */
export function apiErrorDetail(error: Error | undefined): string | null {
  if (!error) return null;
  const m = error.message.match(/^API (\d+): ([\s\S]*)$/);
  if (!m) return error.message;
  try {
    const detail = JSON.parse(m[2]).detail;
    if (typeof detail === "string") return detail;
  } catch {
    // not JSON
  }
  return m[2] || `The server answered ${m[1]}.`;
}
