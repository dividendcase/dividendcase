"use client";

import { useEffect, useMemo, useState } from "react";
import { Milestone, Sprout, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { Segmented } from "@/components/ui/segmented";
import { TickerBadge } from "@/components/ui/ticker-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EChart } from "@/components/charts/EChart";
import { StockSearchField } from "@/components/investments/StockSearchField";
import { useStockData } from "@/lib/hooks/useStockData";
import { chartColors } from "@/lib/chartTheme";
import { CURRENCY_SYMBOLS, formatMoney } from "@/lib/format";
import type { StockSearchResult } from "@/lib/types";

const CURRENCIES = Object.keys(CURRENCY_SYMBOLS).filter((c) => c !== "GBp");

interface ProjectionPoint {
  year: number;
  withDrip: { shares: number; value: number; annualIncome: number };
  noDrip: { shares: number; value: number; annualIncome: number };
}

function computeProjection(
  shares: number,
  stockPrice: number,
  annualDividendPerShare: number,
  dividendGrowthRate: number,
  priceGrowthRate: number,
  years: number,
): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  let dripShares = shares;
  const noDripShares = shares;
  let price = stockPrice;
  let divPerShare = annualDividendPerShare;

  for (let y = 0; y <= years; y++) {
    const dripIncome = dripShares * divPerShare;
    const noDripIncome = noDripShares * divPerShare;

    points.push({
      year: y,
      withDrip: {
        shares: Math.round(dripShares * 100) / 100,
        value: Math.round(dripShares * price * 100) / 100,
        annualIncome: Math.round(dripIncome * 100) / 100,
      },
      noDrip: {
        shares: Math.round(noDripShares * 100) / 100,
        value: Math.round(noDripShares * price * 100) / 100,
        annualIncome: Math.round(noDripIncome * 100) / 100,
      },
    });

    if (y < years) {
      // DRIP: the year's dividends buy more shares at this year's price
      dripShares += price > 0 ? dripIncome / price : 0;
      // Then the dividend and the price grow for next year
      divPerShare *= 1 + dividendGrowthRate / 100;
      price *= 1 + priceGrowthRate / 100;
    }
  }

  return points;
}

/** Numbers typed into the form: blank or invalid falls back to the given value. */
function num(value: string, fallback: number, min = -Infinity, max = Infinity): number {
  const n = Number(value);
  if (value.trim() === "" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function compact(v: number, currency: string): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${formatMoney(v / 1_000_000, currency, { decimals: 1 })}M`;
  if (abs >= 10_000) return `${formatMoney(v / 1000, currency, { decimals: 0 })}k`;
  return formatMoney(v, currency, { decimals: 0 });
}

export default function DripPage() {
  const [form, setForm] = useState({
    shares: "100",
    price: "50",
    dividend: "2",
    divGrowth: "5",
    priceGrowth: "3",
    years: "20",
  });
  const [currency, setCurrency] = useState("USD");
  const [stock, setStock] = useState<StockSearchResult | null>(null);
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  const [tableStep, setTableStep] = useState<1 | 5>(1);
  const { data: stockData, isLoading: stockLoading } = useStockData(stock?.symbol ?? null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Fill the form from the picked stock's latest price, dividend and growth
  useEffect(() => {
    if (!stockData || !stock || filledFrom === stock.symbol) return;
    const m = stockData.metrics;
    const last = stockData.records[stockData.records.length - 1];
    const price = last?.share_price_on_dividend_date;
    setForm((f) => ({
      ...f,
      price: price ? String(Number(price.toFixed(2))) : f.price,
      dividend: m.annual_dividend_estimate != null ? String(Number(m.annual_dividend_estimate.toFixed(4))) : f.dividend,
      divGrowth:
        m.dividend_growth_cagr_5y != null
          ? String(Number(Math.max(-20, Math.min(30, m.dividend_growth_cagr_5y)).toFixed(1)))
          : f.divGrowth,
    }));
    if (stockData.currency && stockData.currency !== "GBp" && CURRENCIES.includes(stockData.currency)) setCurrency(stockData.currency);
    setFilledFrom(stock.symbol);
  }, [stockData, stock, filledFrom]);

  const shares = num(form.shares, 0, 0);
  const stockPrice = num(form.price, 0.01, 0.01);
  const annualDiv = num(form.dividend, 0, 0);
  const divGrowth = num(form.divGrowth, 0, -50, 100);
  const priceGrowth = num(form.priceGrowth, 0, -50, 100);
  const years = Math.round(num(form.years, 20, 1, 50));

  const projection = useMemo(
    () => computeProjection(shares, stockPrice, annualDiv, divGrowth, priceGrowth, years),
    [shares, stockPrice, annualDiv, divGrowth, priceGrowth, years],
  );

  const last = projection[projection.length - 1];
  const initialValue = shares * stockPrice;
  // Without DRIP the dividends are paid out as cash: count them too
  const cashTaken = projection.slice(0, -1).reduce((s, p) => s + p.noDrip.annualIncome, 0);
  const milestoneYear = projection.find((p) => p.withDrip.annualIncome >= 12_000)?.year ?? null;
  const yieldOnPrice = stockPrice > 0 ? (annualDiv / stockPrice) * 100 : 0;
  const growthPct = initialValue > 0 ? (last.withDrip.value / initialValue - 1) * 100 : 0;

  const labels = useMemo(() => projection.map((p) => `Y${p.year}`), [projection]);
  const axisInterval = Math.max(0, Math.ceil(years / 10) - 1);

  const valueOption = useMemo(() => ({
    tooltip: { trigger: "axis", valueFormatter: (v: number) => formatMoney(v, currency, { decimals: 0 }) },
    legend: { data: ["With DRIP", "Without DRIP"], bottom: 0 },
    grid: { top: 12, right: 8, bottom: 36, left: 8, containLabel: true },
    xAxis: { type: "category", data: labels, boundaryGap: false, axisLabel: { interval: axisInterval } },
    yAxis: { type: "value", axisLabel: { formatter: (v: number) => compact(v, currency) } },
    series: [
      {
        name: "With DRIP",
        type: "line",
        smooth: true,
        data: projection.map((p) => p.withDrip.value),
        lineStyle: { color: chartColors.sprout, width: 2.5 },
        itemStyle: { color: chartColors.sprout },
        areaStyle: { color: "rgba(122,191,80,0.10)" },
      },
      {
        name: "Without DRIP",
        type: "line",
        smooth: true,
        data: projection.map((p) => p.noDrip.value),
        lineStyle: { color: chartColors.ink2, width: 1.75, type: "dashed" },
        itemStyle: { color: chartColors.ink2 },
      },
    ],
  }), [projection, currency, labels, axisInterval]);

  const incomeOption = useMemo(() => {
    const later = projection.filter((p) => p.year > 0);
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number) => formatMoney(v, currency, { decimals: 0 }) },
      legend: { data: ["With DRIP", "Without DRIP"], bottom: 0 },
      grid: { top: 12, right: 8, bottom: 36, left: 8, containLabel: true },
      xAxis: { type: "category", data: later.map((p) => `Y${p.year}`), axisLabel: { interval: axisInterval } },
      yAxis: { type: "value", axisLabel: { formatter: (v: number) => compact(v, currency) } },
      series: [
        {
          name: "With DRIP",
          type: "bar",
          data: later.map((p) => Math.round(p.withDrip.annualIncome)),
          itemStyle: { color: chartColors.sprout },
          barMaxWidth: 18,
          barGap: "15%",
        },
        {
          name: "Without DRIP",
          type: "bar",
          data: later.map((p) => Math.round(p.noDrip.annualIncome)),
          itemStyle: { color: chartColors.lineStrong },
          barMaxWidth: 18,
        },
      ],
    };
  }, [projection, currency, axisInterval]);

  const rows = projection.filter((p) => tableStep === 1 || p.year % 5 === 0 || p.year === years);

  return (
    <div className="space-y-6">
      <PageHeader
        title="DRIP calculator"
        description="See how reinvesting every dividend into more shares compounds over the years, compared with taking dividends as cash."
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Inputs */}
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Your starting point</CardTitle>
            <CardDescription>Change any number and the projection updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="drip-stock">Start from a stock (optional)</Label>
              {stock ? (
                <div className="flex h-9 items-center gap-2 rounded-md border border-line bg-well pl-1.5 pr-1">
                  <TickerBadge ticker={stock.symbol} />
                  <span className="num text-[13px] font-medium text-ink">{stock.symbol}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">
                    {stockLoading ? "Loading…" : filledFrom === stock.symbol ? "Filled in" : stock.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Clear stock"
                    onClick={() => {
                      setStock(null);
                      setFilledFrom(null);
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <StockSearchField id="drip-stock" placeholder="Ticker, such as O or ENB.TO" onSelect={setStock} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field id="drip-shares" label="Shares" value={form.shares} onChange={set("shares")} min={0} step="any" />
              <Field id="drip-price" label="Price per share" value={form.price} onChange={set("price")} min={0.01} step="0.01" />
              <Field id="drip-div" label="Dividend per year" hint="Per share" value={form.dividend} onChange={set("dividend")} min={0} step="0.01" />
              <Field id="drip-years" label="Years" value={form.years} onChange={set("years")} min={1} max={50} step="1" />
              <Field id="drip-div-growth" label="Dividend growth" hint="% a year" value={form.divGrowth} onChange={set("divGrowth")} step="0.5" />
              <Field id="drip-price-growth" label="Price growth" hint="% a year" value={form.priceGrowth} onChange={set("priceGrowth")} step="0.5" />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="drip-currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="drip-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>
                      <span className="num">{code}</span>
                      <span className="ml-2 text-ink-3">{CURRENCY_SYMBOLS[code].trim()}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="border-t border-line pt-3 text-[12px] leading-relaxed text-ink-3">
              Starting yield <span className="num text-ink-2">{yieldOnPrice.toFixed(2)}%</span>. Assumes every dividend is
              reinvested once a year at that year&apos;s price, with no tax or fees.
            </p>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat
              label={`Income, year ${years}`}
              tone="money"
              value={formatMoney(last.withDrip.annualIncome, currency)}
              sub={
                <>
                  <span className="num">{formatMoney(last.withDrip.annualIncome / 12, currency)}</span> a month with DRIP
                </>
              }
            />
            <Stat
              label="Income, no DRIP"
              value={formatMoney(last.noDrip.annualIncome, currency)}
              sub={`Year ${years}, dividends taken as cash`}
            />
            <Stat
              label={`Value, year ${years}`}
              value={compact(last.withDrip.value, currency)}
              sub={
                <>
                  <span className="num">{last.withDrip.shares.toLocaleString("en", { maximumFractionDigits: 1 })}</span> shares ·{" "}
                  <span className="num">
                    {growthPct >= 0 ? "+" : "−"}
                    {Math.abs(growthPct).toFixed(0)}%
                  </span>
                </>
              }
            />
            <Stat
              label="Value without DRIP"
              value={compact(last.noDrip.value, currency)}
              sub={
                <>
                  Plus <span className="num">{compact(cashTaken, currency)}</span> taken as cash
                </>
              }
            />
          </div>

          {initialValue > 0 && annualDiv > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-xl border border-sprout/25 bg-sprout/10 px-4 py-3 text-[13px] text-ink-2">
                <Sprout className="mt-0.5 size-4 shrink-0 text-sprout" />
                <p>
                  Reinvesting leaves you{" "}
                  <span className="num font-medium text-money">
                    {formatMoney(last.withDrip.annualIncome - last.noDrip.annualIncome, currency)}
                  </span>{" "}
                  more income a year by year {years}, from{" "}
                  <span className="num text-ink">{(last.withDrip.shares - last.noDrip.shares).toLocaleString("en", { maximumFractionDigits: 1 })}</span>{" "}
                  extra shares.
                </p>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-line bg-raised px-4 py-3 text-[13px] text-ink-2">
                <Milestone className="mt-0.5 size-4 shrink-0" />
                <p>
                  {milestoneYear != null ? (
                    <>
                      With DRIP you reach <span className="num text-ink">{formatMoney(1000, currency)}</span> a month in{" "}
                      <span className="num text-ink">year {milestoneYear}</span>.
                    </>
                  ) : (
                    <>
                      <span className="num text-ink">{formatMoney(1000, currency)}</span> a month isn&apos;t reached within{" "}
                      <span className="num">{years}</span> years with these numbers.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Value of your shares</CardTitle>
                <CardDescription>Without DRIP, dividends taken as cash are not included.</CardDescription>
              </CardHeader>
              <CardContent>
                <EChart option={valueOption} style={{ height: 280 }} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Dividend income each year</CardTitle>
                <CardDescription>What your shares pay in that year.</CardDescription>
              </CardHeader>
              <CardContent>
                <EChart option={incomeOption} style={{ height: 280 }} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 border-b border-line">
              <CardTitle>Year by year</CardTitle>
              <Segmented
                aria-label="Rows"
                value={tableStep}
                onChange={setTableStep}
                options={[
                  { value: 1, label: "Every year" },
                  { value: 5, label: "Every 5" },
                ]}
              />
            </CardHeader>
            <Table className="min-w-[640px]">
              <THead>
                <tr>
                  <TH>Year</TH>
                  <TH numeric>Shares</TH>
                  <TH numeric>Value</TH>
                  <TH numeric>Income</TH>
                  <TH numeric className="border-l border-line">Value, no DRIP</TH>
                  <TH numeric>Income, no DRIP</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((p) => (
                  <TR key={p.year}>
                    <TD className="num text-ink">{p.year}</TD>
                    <TD numeric className="text-ink-2">
                      {p.withDrip.shares.toLocaleString("en", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </TD>
                    <TD numeric>{formatMoney(p.withDrip.value, currency, { decimals: 0 })}</TD>
                    <TD numeric className="text-money">{formatMoney(p.withDrip.annualIncome, currency, { decimals: 0 })}</TD>
                    <TD numeric className="border-l border-line text-ink-2">{formatMoney(p.noDrip.value, currency, { decimals: 0 })}</TD>
                    <TD numeric className="text-ink-2">{formatMoney(p.noDrip.annualIncome, currency, { decimals: 0 })}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id} className="leading-tight">
        {label}
        {hint && <span className="ml-1 font-normal text-ink-3">{hint}</span>}
      </Label>
      <Input id={id} type="number" inputMode="decimal" className="num" value={value} onChange={onChange} min={min} max={max} step={step} />
    </div>
  );
}
