"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Info, Plus } from "lucide-react";
import { useIncomeCalendar } from "@/lib/hooks/useIncomeCalendar";
import { usePortfolios } from "@/lib/hooks/usePortfolios";
import { convertAmount, useHomeCurrency } from "@/lib/fx";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TickerBadge } from "@/components/ui/ticker-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EChart } from "@/components/charts/EChart";
import { categorical, chartColors } from "@/lib/chartTheme";
import { currencyLabel, daysUntil, formatMoney, formatShortDate, frequencyLabel } from "@/lib/format";
import { stockHref } from "@/components/investments/stockDetail";
import { HOME_MODE, HomeCurrencyHint, homeOption, sameCurrency } from "@/components/investments/homeCurrency";
import type { CalendarEntry } from "@/lib/types";

/** "2026-10" → Date for the first of that month */
function monthDate(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}
const monthLong = (key: string) => monthDate(key).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const monthShort = (key: string) => {
  const d = monthDate(key);
  return `${d.toLocaleDateString("en-GB", { month: "short" })} ${String(d.getFullYear()).slice(2)}`;
};

/** Every month from the first to the last key, so empty months show on the chart. */
function monthRange(first: string, last: string): string[] {
  const out: string[] = [];
  let [y, m] = first.split("-").map(Number);
  const [endY, endM] = last.split("-").map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** An expected payment with its amount in the home currency (null when there's no rate for it). */
type Entry = CalendarEntry & { home: number | null };

function sumByCurrency(entries: CalendarEntry[]): [string, number][] {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.currency, (map.get(e.currency) ?? 0) + e.estimated_amount);
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

/** The amount as shown, with the original underneath when it was converted from another currency. */
function Amount({ value, currency, original, originalCurrency }: {
  value: number;
  currency: string;
  original?: number;
  originalCurrency?: string;
}) {
  return (
    <>
      <span className="text-money">{formatMoney(value, currency, { decimals: 2 })}</span>
      {original != null && originalCurrency && !sameCurrency(originalCurrency, currency) && (
        <span className="block text-[11px] text-ink-3">{formatMoney(original, originalCurrency, { decimals: 2 })}</span>
      )}
    </>
  );
}

function whenLabel(iso: string): string | null {
  const d = daysUntil(iso);
  if (d < 0 || d > 30) return null;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `in ${d} days`;
}

export default function CalendarPage() {
  const { portfolios } = usePortfolios();
  const [portfolioId, setPortfolioId] = useState<number | undefined>(undefined);
  const { data, error, isLoading } = useIncomeCalendar(portfolioId);
  const { home, fx, canConvert } = useHomeCurrency();
  const [pickedCurrency, setPickedCurrency] = useState<string | null>(null);
  const [listView, setListView] = useState<"month" | "stock">("month");

  // Future payments convert at the latest rates
  const entries = useMemo<Entry[]>(
    () =>
      (data?.entries ?? [])
        .slice()
        .sort((a, b) => a.expected_date.localeCompare(b.expected_date))
        .map((e) => ({ ...e, home: canConvert && home ? convertAmount(e.estimated_amount, e.currency, home, fx) : null })),
    [data, canConvert, home, fx]
  );

  // Currencies, the one with the most income first
  const currencies = useMemo(() => {
    const totals = data?.currency_totals ?? {};
    return Object.keys(totals).sort((a, b) => {
      const ca = entries.filter((e) => e.currency === a).length;
      const cb = entries.filter((e) => e.currency === b).length;
      return cb - ca || a.localeCompare(b);
    });
  }, [data, entries]);

  // "All in EUR" is the default whenever amounts can be converted; otherwise one currency at a time
  const homeMode =
    canConvert && !!home && (pickedCurrency == null || pickedCurrency === HOME_MODE || !currencies.includes(pickedCurrency));
  const currency = homeMode
    ? home!
    : pickedCurrency && currencies.includes(pickedCurrency)
      ? pickedCurrency
      : currencies[0];
  /** The amount an entry adds to the totals, in `currency` */
  const valueOf = (e: Entry) => (homeMode ? e.home ?? 0 : e.estimated_amount);
  // Entries counted in the totals and the chart: all that convert, or those in the picked currency
  const curEntries = useMemo(
    () => (homeMode ? entries.filter((e) => e.home != null) : entries.filter((e) => e.currency === currency)),
    [entries, currency, homeMode]
  );
  const unconverted = useMemo(
    () => (homeMode ? Array.from(new Set(entries.filter((e) => e.home == null).map((e) => e.currency))).sort() : []),
    [entries, homeMode]
  );

  const months = useMemo(() => {
    if (entries.length === 0) return [];
    return monthRange(entries[0].expected_date.slice(0, 7), entries[entries.length - 1].expected_date.slice(0, 7));
  }, [entries]);

  const byMonth = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const key = e.expected_date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [entries]);

  const gapMonths = months.filter((m) => !byMonth.has(m));

  const tickerColor = useMemo(() => {
    const tickers = Array.from(new Set(entries.map((e) => e.ticker_symbol))).sort();
    return Object.fromEntries(tickers.map((t, i) => [t, categorical[i % categorical.length]]));
  }, [entries]);

  const chartOption = useMemo(() => {
    if (!currency || months.length === 0) return null;
    const tickers = Array.from(new Set(curEntries.map((e) => e.ticker_symbol))).sort();
    return {
      grid: { top: 12, right: 8, bottom: 36, left: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: { seriesName: string; value: number; marker: string; name: string }[]) => {
          const rows = params.filter((p) => Number(p.value) > 0).sort((a, b) => Number(b.value) - Number(a.value));
          const total = rows.reduce((s, p) => s + Number(p.value), 0);
          const line = (left: string, v: number, bold = false) =>
            `<div style="display:flex;justify-content:space-between;gap:16px;${bold ? "font-weight:600" : ""}"><span>${left}</span><span style="font-variant-numeric:tabular-nums">${formatMoney(v, currency, { decimals: 2 })}</span></div>`;
          let html = `<div style="margin-bottom:4px;color:${chartColors.ink3}">${params[0]?.name ?? ""}</div>`;
          if (rows.length === 0) return html + `<div style="color:${chartColors.ink3}">No payments expected</div>`;
          html += line("Total", total, true);
          for (const p of rows) html += line(`${p.marker}${p.seriesName}`, Number(p.value));
          return html;
        },
      },
      legend: { type: "scroll", bottom: 0, data: tickers },
      xAxis: { type: "category", data: months.map(monthShort), axisLabel: { hideOverlap: true } },
      yAxis: {
        type: "value",
        axisLabel: { formatter: (v: number) => formatMoney(v, currency, { decimals: 0 }) },
      },
      series: tickers.map((ticker) => ({
        name: ticker,
        type: "bar",
        stack: "income",
        barMaxWidth: 36,
        itemStyle: { color: tickerColor[ticker], borderRadius: 0 },
        data: months.map((m) =>
          Math.round(
            (byMonth.get(m) ?? [])
              .filter((e) => e.ticker_symbol === ticker && (homeMode ? e.home != null : e.currency === currency))
              .reduce((s, e) => s + (homeMode ? e.home ?? 0 : e.estimated_amount), 0) * 100
          ) / 100
        ),
      })),
    };
  }, [currency, homeMode, months, curEntries, byMonth, tickerColor]);

  const byStock = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) map.set(e.ticker_symbol, [...(map.get(e.ticker_symbol) ?? []), e]);
    return Array.from(map.entries())
      .map(([ticker, list]) => ({
        ticker,
        first: list[0],
        count: list.length,
        total: list.reduce((s, e) => s + e.estimated_amount, 0),
        // A stock pays in one currency, so either every payment converts or none does
        home: list.every((e) => e.home != null) ? list.reduce((s, e) => s + (e.home ?? 0), 0) : null,
      }))
      .sort((a, b) => a.first.expected_date.localeCompare(b.first.expected_date));
  }, [entries]);

  const portfolioPicker =
    portfolios.length > 1 ? (
      <Select value={portfolioId != null ? String(portfolioId) : "all"} onValueChange={(v) => setPortfolioId(v === "all" ? undefined : Number(v))}>
        <SelectTrigger className="w-48" aria-label="Portfolio">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All portfolios</SelectItem>
          {portfolios.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : undefined;

  const header = (
    <PageHeader
      title="Calendar"
      description="Dividends your holdings are expected to pay over the next 12 months, estimated from each stock's last payment and how often it pays."
      actions={portfolioPicker}
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[360px] rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !data || entries.length === 0 || !currency) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={<CalendarDays />}
          title={error ? "Couldn't load the calendar" : "No dividends expected yet"}
          description={
            error
              ? "The local DividendCase server didn't answer. Check that the app is still running, then reload."
              : "Add holdings that pay dividends and their upcoming payments appear here. Newly added stocks can take a minute to fetch."
          }
          action={
            !error && (
              <Button asChild>
                <Link href="/dashboard/investments/?add=1">
                  <Plus className="size-4" />
                  Add holding
                </Link>
              </Button>
            )
          }
        />
      </div>
    );
  }

  const annual = homeMode
    ? curEntries.reduce((s, e) => s + valueOf(e), 0)
    : data.currency_totals[currency] ?? curEntries.reduce((s, e) => s + e.estimated_amount, 0);
  const next = curEntries.find((e) => daysUntil(e.expected_date) >= 0) ?? curEntries[0];
  const stockCount = new Set(curEntries.map((e) => e.ticker_symbol)).size;
  const monthsWithIncome = new Set(curEntries.map((e) => e.expected_date.slice(0, 7))).size;
  const mixed = currencies.length > 1;
  // A picker when there's more than one way to show the totals
  const showPicker = canConvert && home ? mixed || !sameCurrency(currencies[0], home) : mixed;
  const hint = mixed ? <HomeCurrencyHint home={home} fx={fx} canConvert={canConvert} /> : null;

  return (
    <div className="space-y-6">
      {header}

      <section aria-label="Summary" className="space-y-3">
        {showPicker && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] text-ink-3">
              {mixed ? (
                <>
                  Your dividends come in <span className="num">{currencies.length}</span> currencies
                </>
              ) : (
                <>
                  Your dividends are paid in <span className="font-mono">{currencyLabel(currencies[0])}</span>
                </>
              )}
              {homeMode ? (
                <>
                  , shown here in <span className="font-mono">{currencyLabel(currency)}</span> at today&apos;s European Central
                  Bank rates.
                </>
              ) : mixed ? (
                ". Totals and the chart show one at a time."
              ) : (
                "."
              )}
              {hint && <> {hint}</>}
            </p>
            <Segmented
              aria-label="Currency"
              value={homeMode ? HOME_MODE : currency}
              onChange={setPickedCurrency}
              options={[
                ...(canConvert && home ? [homeOption(home)] : []),
                ...currencies.map((c) => ({ value: c, label: <span className="font-mono">{currencyLabel(c)}</span> })),
              ]}
            />
          </div>
        )}
        {unconverted.length > 0 && (
          <p className="flex items-start gap-2 text-[12.5px] text-ink-3">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              No exchange rate for <span className="font-mono text-ink-2">{unconverted.map(currencyLabel).join(", ")}</span>, so
              those payments are left out of the totals and the chart.
            </span>
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Next 12 months"
            tone="money"
            value={formatMoney(annual, currency)}
            sub={showPicker ? `Estimated, in ${currencyLabel(currency)}` : "Estimated"}
          />
          <Stat
            label="Monthly average"
            value={formatMoney(annual / 12, currency)}
            sub={
              <>
                Income in <span className="num">{monthsWithIncome}</span> of <span className="num">{months.length}</span> months
              </>
            }
          />
          <Stat
            label="Next payment"
            value={next ? formatShortDate(next.expected_date) : "—"}
            sub={
              next && (
                <>
                  <span className="num text-ink-2">{next.ticker_symbol}</span> ·{" "}
                  <span className="num text-money">{formatMoney(valueOf(next), currency)}</span>
                  {whenLabel(next.expected_date) && <> · {whenLabel(next.expected_date)}</>}
                </>
              )
            }
          />
          <Stat
            label="Payments"
            value={curEntries.length}
            sub={
              <>
                From <span className="num">{stockCount}</span> stock{stockCount === 1 ? "" : "s"}
              </>
            }
          />
        </div>
      </section>

      {gapMonths.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-watch/25 bg-watch/10 px-4 py-3 text-[13px] text-watch">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-medium">No income expected in {gapMonths.length === 1 ? "one month" : `${gapMonths.length} months`}:</span>{" "}
            {gapMonths.map(monthLong).join(", ")}. A stock that pays in those months would even out your income.
          </p>
        </div>
      )}

      {chartOption && (
        <Card>
          <CardHeader>
            <CardTitle>Month by month</CardTitle>
            <CardDescription>
              Expected dividends per month
              {homeMode && showPicker
                ? ` in ${currencyLabel(currency)} at today's exchange rates`
                : showPicker
                  ? ` in ${currencyLabel(currency)}`
                  : ""}
              , by stock.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EChart option={chartOption} style={{ height: 300 }} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-3 border-b border-line sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Upcoming payments</CardTitle>
            <CardDescription>Amounts are estimates: your shares times the last dividend per share.</CardDescription>
          </div>
          <Segmented
            aria-label="Group payments"
            value={listView}
            onChange={setListView}
            options={[
              { value: "month", label: "By month" },
              { value: "stock", label: "By stock" },
            ]}
          />
        </CardHeader>

        {listView === "month" ? (
          <Table className="min-w-[680px]">
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Stock</TH>
                <TH>Pays</TH>
                <TH numeric>Shares</TH>
                <TH numeric>Per share</TH>
                <TH numeric>Amount</TH>
              </tr>
            </THead>
            <TBody>
              {months
                .filter((m) => byMonth.has(m))
                .map((m) => {
                  const list = byMonth.get(m)!;
                  return (
                    <Fragment key={m}>
                      <tr className="border-t border-line bg-well first:border-t-0">
                        <td colSpan={5} className="px-4 py-2 text-[12.5px] font-medium text-ink">
                          {monthLong(m)}
                          <span className="ml-2 text-ink-3">
                            <span className="num">{list.length}</span> payment{list.length === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="num px-4 py-2 text-right text-[12.5px] text-money">
                          {(homeMode
                            ? [
                                ...(list.some((e) => e.home != null)
                                  ? [formatMoney(list.reduce((s, e) => s + (e.home ?? 0), 0), currency)]
                                  : []),
                                ...sumByCurrency(list.filter((e) => e.home == null)).map(([c, v]) => formatMoney(v, c)),
                              ]
                            : sumByCurrency(list).map(([c, v]) => formatMoney(v, c))
                          ).join(" · ")}
                        </td>
                      </tr>
                      {list.map((e, i) => (
                        <TR key={`${e.ticker_symbol}-${e.expected_date}-${i}`}>
                          <TD className="whitespace-nowrap">
                            <span className="num text-ink">{formatShortDate(e.expected_date)}</span>
                            {whenLabel(e.expected_date) && (
                              <span className="ml-2 text-[11.5px] text-ink-3">{whenLabel(e.expected_date)}</span>
                            )}
                          </TD>
                          <TD>
                            <StockCell ticker={e.ticker_symbol} name={e.company_name} />
                          </TD>
                          <TD className="text-[12.5px]">{frequencyLabel(e.payment_frequency)}</TD>
                          <TD numeric className="text-ink-2">
                            {e.total_shares.toLocaleString("en", { maximumFractionDigits: 4 })}
                          </TD>
                          <TD numeric className="text-ink-2">
                            {formatMoney(e.amount_per_share, e.currency, { decimals: e.amount_per_share < 1 ? 4 : 2 })}
                          </TD>
                          <TD numeric>
                            {homeMode && e.home != null ? (
                              <Amount value={e.home} currency={currency} original={e.estimated_amount} originalCurrency={e.currency} />
                            ) : (
                              <Amount value={e.estimated_amount} currency={e.currency} />
                            )}
                          </TD>
                        </TR>
                      ))}
                    </Fragment>
                  );
                })}
            </TBody>
          </Table>
        ) : (
          <Table className="min-w-[680px]">
            <THead>
              <tr>
                <TH>Stock</TH>
                <TH>Pays</TH>
                <TH numeric>Shares</TH>
                <TH numeric>Next</TH>
                <TH numeric>Payments</TH>
                <TH numeric>12 months</TH>
              </tr>
            </THead>
            <TBody>
              {byStock.map((s) => (
                <TR key={s.ticker}>
                  <TD>
                    <StockCell ticker={s.ticker} name={s.first.company_name} color={tickerColor[s.ticker]} />
                  </TD>
                  <TD className="text-[12.5px]">{frequencyLabel(s.first.payment_frequency)}</TD>
                  <TD numeric className="text-ink-2">
                    {s.first.total_shares.toLocaleString("en", { maximumFractionDigits: 4 })}
                  </TD>
                  <TD numeric className="text-ink-2">
                    {formatShortDate(s.first.expected_date)}
                  </TD>
                  <TD numeric className="text-ink-2">
                    {s.count}
                  </TD>
                  <TD numeric>
                    {homeMode && s.home != null ? (
                      <Amount value={s.home} currency={currency} original={s.total} originalCurrency={s.first.currency} />
                    ) : (
                      <Amount value={s.total} currency={s.first.currency} />
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function StockCell({ ticker, name, color }: { ticker: string; name: string; color?: string }) {
  return (
    <Link href={stockHref(ticker)} className="group flex min-w-0 items-center gap-2.5">
      <TickerBadge ticker={ticker} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          {color && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
          <span className="num truncate text-[13px] font-medium text-ink group-hover:text-sprout">{ticker}</span>
        </span>
        <span className="block max-w-[220px] truncate text-[12px] text-ink-3">{name}</span>
      </span>
    </Link>
  );
}
