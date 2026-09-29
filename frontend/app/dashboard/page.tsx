"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CalendarClock, CalendarDays, Plus, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppActions } from "@/components/layout/AppActions";
import { Welcome } from "@/components/home/Welcome";
import { MonthlyIncomeChart } from "@/components/home/MonthlyIncomeChart";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { TickerBadge } from "@/components/ui/ticker-badge";
import { InfoTip } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIncomeCalendar } from "@/lib/hooks/useIncomeCalendar";
import { useInvestments } from "@/lib/hooks/useInvestments";
import { usePortfolios } from "@/lib/hooks/usePortfolios";
import { useDataStatus } from "@/lib/hooks/useDataStatus";
import { buildIncomeModel, monthName, toHomeCurrency, type CurrencyIncome, type IncomeModel } from "@/lib/income";
import { currencyLabel, daysUntil, formatMoney, formatShortDate, frequencyLabel } from "@/lib/format";
import { convertAmount, useHomeCurrency, usePortfolioCost } from "@/lib/fx";
import { cn } from "@/lib/utils";
import type { CalendarEntry, FxRates } from "@/lib/types";

function IncomeContent() {
  const router = useRouter();
  const params = useSearchParams();

  // Old links opened a stock with /dashboard?ticker=X
  const legacyTicker = params.get("ticker");
  useEffect(() => {
    if (legacyTicker) router.replace(`/dashboard/stock/?t=${encodeURIComponent(legacyTicker.toUpperCase())}`);
  }, [legacyTicker, router]);

  const { portfolios } = usePortfolios();
  const [portfolioId, setPortfolioId] = useState<number | undefined>(undefined);
  const { items: investments, isLoading: investmentsLoading } = useInvestments(portfolioId);
  const { items: allInvestments, isLoading: allLoading } = useInvestments();
  const { data: calendar, isLoading: calendarLoading } = useIncomeCalendar(portfolioId);
  const { status } = useDataStatus();
  const { openImport } = useAppActions();

  const model = useMemo(() => buildIncomeModel(calendar, investments), [calendar, investments]);
  const { home, fx, canConvert } = useHomeCurrency();
  const cost = usePortfolioCost(canConvert ? home : null, portfolioId);
  const homeIncome = useMemo(
    () => (canConvert && home && fx && calendar ? toHomeCurrency(calendar, home, fx, cost?.total || null) : undefined),
    [canConvert, home, fx, calendar, cost]
  );
  // "All in EUR" first when rates allow it, then each currency on its own
  const HOME = "__home";
  const views = [...(homeIncome && model.currencies.length > 0 ? [HOME] : []), ...model.currencies];
  const [picked, setPicked] = useState<string | null>(null);
  const view = picked && views.includes(picked) ? picked : views[0];
  const income = view === HOME ? homeIncome : view ? model.byCurrency[view] : undefined;

  if (legacyTicker) return null;
  if (allLoading) return <HomeSkeleton />;
  if (allInvestments.length === 0) return <Welcome />;

  const loading = investmentsLoading || calendarLoading;
  const next = model.upcoming[0];
  const nextAmount = next ? inView(next.estimated_amount, next.currency, income, fx) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Income"
        description={
          <>
            Projected from each holding&apos;s latest dividend and how often it pays.{" "}
            <span className="text-ink-3">
              <span className="num">{model.holdings.length}</span> holdings
              {model.currencies.length > 1 && <> · <span className="num">{model.currencies.length}</span> currencies</>}
            </span>
          </>
        }
        actions={
          <>
            {portfolios.length > 1 && (
              <Select value={portfolioId == null ? "all" : String(portfolioId)} onValueChange={(v) => setPortfolioId(v === "all" ? undefined : Number(v))}>
                <SelectTrigger className="h-8 w-auto min-w-40 text-[13px]" aria-label="Portfolio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All portfolios</SelectItem>
                  {portfolios.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {views.length > 1 && view && (
              <Segmented
                value={view}
                onChange={setPicked}
                options={views.map((v) => ({
                  value: v,
                  label: v === HOME ? <>All in <span className="num">{currencyLabel(home)}</span></> : <span className="num">{currencyLabel(v)}</span>,
                  title: v === HOME ? "Every payment converted at today's exchange rate" : `Only holdings that pay in ${currencyLabel(v)}`,
                }))}
                aria-label="Currency"
              />
            )}
          </>
        }
      />

      {loading && !calendar ? (
        <HomeSkeleton bare />
      ) : !income ? (
        <NoIncomeYet model={model} missing={status?.your_tickers_missing ?? 0} />
      ) : (
        <>
          {!canConvert && model.currencies.length > 1 && (
            <p className="text-[12.5px] text-ink-3">
              {home ? (
                "Exchange rates are downloading. Everything will show in one currency in a moment."
              ) : (
                <>
                  Your income comes in <span className="num">{model.currencies.length}</span> currencies.{" "}
                  <Link href="/dashboard/settings/" className="text-ink-2 underline-offset-2 hover:underline">Set a home currency</Link> to see it all in one.
                </>
              )}
            </p>
          )}
          {income.isHome && (income.skipped?.length ?? 0) > 0 && (
            <p className="text-[12.5px] text-watch">
              ▲ Left out: no exchange rate for <span className="num">{income.skipped!.map(currencyLabel).join(", ")}</span>.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Next 12 months"
              value={formatMoney(income.annual, income.currency, { decimals: 0 })}
              sub={<>≈ <span className="num">{formatMoney(income.annual / 12, income.currency, { decimals: 0 })}</span> a month</>}
              tone="money"
            />
            <Stat
              label="Yield on cost"
              value={income.cost ? `${((income.annual / income.cost) * 100).toFixed(2)}%` : "—"}
              sub={
                income.cost ? (
                  <>
                    on <span className="num">{formatMoney(income.cost, income.currency, { decimals: 0 })}</span> invested
                    {income.isHome && " at the time's rates"}
                  </>
                ) : (
                  "Add purchase prices to see it"
                )
              }
            />
            <Stat
              label="Next payment"
              value={next ? formatMoney(nextAmount!.amount, nextAmount!.currency) : "—"}
              sub={next ? `${next.company_name} · ${formatShortDate(next.expected_date)}` : "None in the next year"}
            />
            <Stat
              label="Holdings"
              value={model.holdings.length}
              sub={
                income.isHome
                  ? `${income.payers.length} pay dividends${model.nonPayers.length ? ` · ${model.nonPayers.length} don't` : ""}`
                  : `${income.payers.length} pay in ${currencyLabel(income.currency)}${model.nonPayers.length ? ` · ${model.nonPayers.length} don't pay` : ""}`
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3 pb-2">
                <div className="flex items-center gap-1.5">
                  <CardTitle>Monthly income</CardTitle>
                  <InfoTip>
                    Each holding&apos;s latest dividend × your shares, repeated at its usual rhythm for the next 12 months.
                    Before tax, in {currencyLabel(income.currency)}
                    {income.isHome ? ", converted at the latest European Central Bank rates." : "."}
                  </InfoTip>
                </div>
                <Link href="/dashboard/calendar/" className="inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
                  Calendar <ArrowRight className="size-3.5" />
                </Link>
              </CardHeader>
              <div className="px-3 pb-4 sm:px-4">
                <MonthlyIncomeChart income={income} />
              </div>
            </Card>

            <ComingUp entries={model.upcoming} income={income} fx={fx} />
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <TopPayers income={income} />
            <Insights income={income} model={model} missing={status?.your_tickers_missing ?? 0} />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/investments/"><Plus className="size-4" />Add holding</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={openImport}>
          <Upload className="size-4" />
          Import from Excel
        </Button>
      </div>
    </div>
  );
}

function NoIncomeYet({ model, missing }: { model: IncomeModel; missing: number }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <CalendarClock className="size-6 text-ink-3" />
      <p className="text-[15px] font-semibold text-ink">
        {missing > 0 ? "Fetching dividend history for your holdings…" : "No dividends expected in the next year"}
      </p>
      <p className="max-w-md text-[13px] text-ink-3">
        {missing > 0
          ? `${missing} of your stocks are still waiting for data from Yahoo Finance. This page fills in as they arrive.`
          : `None of your ${model.holdings.length} holdings has paid a dividend in the last three years.`}
      </p>
    </Card>
  );
}

/** An amount as the current view shows it: converted in the home view, as paid otherwise. */
function inView(amount: number, currency: string, income: CurrencyIncome | undefined, fx: FxRates | undefined) {
  if (income?.isHome) {
    const converted = convertAmount(amount, currency, income.currency, fx);
    if (converted != null) return { amount: converted, currency: income.currency, original: currency !== income.currency ? { amount, currency } : null };
  }
  return { amount, currency, original: null };
}

function ComingUp({ entries, income, fx }: { entries: CalendarEntry[]; income?: CurrencyIncome; fx?: FxRates }) {
  const soon = entries.slice(0, 6);
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between pb-1">
        <CardTitle>Coming up</CardTitle>
        <CalendarDays className="size-4 text-ink-3" />
      </CardHeader>
      {soon.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-ink-3">No payments expected in the next year.</p>
      ) : (
        <ul className="flex-1 px-2 pb-2">
          {soon.map((e, i) => {
            const days = daysUntil(e.expected_date);
            const d = new Date(`${e.expected_date}T00:00:00`);
            return (
              <li key={`${e.ticker_symbol}-${e.expected_date}-${i}`}>
                <Link
                  href={`/dashboard/stock/?t=${encodeURIComponent(e.ticker_symbol)}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-raised/60"
                >
                  <div className="flex w-10 shrink-0 flex-col items-center rounded-md border border-line bg-well py-1 leading-none">
                    <span className="num text-[15px] font-medium text-ink">{d.getDate()}</span>
                    <span className="mt-0.5 font-mono text-[9.5px] uppercase text-ink-3">{d.toLocaleDateString("en-GB", { month: "short" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">{e.company_name}</p>
                    <p className="truncate text-[12px] text-ink-3">
                      <span className="num">{e.ticker_symbol}</span> · {frequencyLabel(e.payment_frequency).toLowerCase()}
                      {days <= 7 && <span className="text-sprout-hi"> · {days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}</span>}
                    </p>
                  </div>
                  {(() => {
                    const shown = inView(e.estimated_amount, e.currency, income, fx);
                    return (
                      <span className="shrink-0 text-right">
                        <span className="num block text-[13.5px] text-money">{formatMoney(shown.amount, shown.currency)}</span>
                        {shown.original && (
                          <span className="num block text-[11px] text-ink-3">{formatMoney(shown.original.amount, shown.original.currency)}</span>
                        )}
                      </span>
                    );
                  })()}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function TopPayers({ income }: { income: CurrencyIncome }) {
  const rows = income.payers.slice(0, 8);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle>Where it comes from</CardTitle>
        <Link href="/dashboard/investments/" className="inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
          All holdings <ArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] sm:min-w-[560px]">
          <thead>
            <tr className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
              <th className="py-2 pl-5 pr-3 text-left font-medium">Holding</th>
              <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">Pays</th>
              <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Shares</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Next</th>
              <th className="px-3 py-2 text-right font-medium">A year</th>
              <th className="py-2 pl-3 pr-5 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.ticker} className="group border-t border-line transition-colors hover:bg-raised/50">
                <td className="py-2.5 pl-5 pr-3">
                  <Link href={`/dashboard/stock/?t=${encodeURIComponent(p.ticker)}`} className="flex min-w-0 items-center gap-3">
                    <TickerBadge ticker={p.ticker} />
                    <span className="min-w-0">
                      <span className="block max-w-[140px] truncate font-medium text-ink group-hover:text-sprout-hi sm:max-w-[220px]">{p.company}</span>
                      <span className="num block text-[12px] text-ink-3">{p.ticker}</span>
                    </span>
                  </Link>
                </td>
                <td className="hidden px-3 py-2.5 text-ink-2 sm:table-cell">{frequencyLabel(p.frequency)}</td>
                <td className="num hidden px-3 py-2.5 text-right text-ink-2 md:table-cell">{p.shares.toLocaleString("en", { maximumFractionDigits: 3 })}</td>
                <td className="num hidden px-3 py-2.5 text-right text-ink-2 sm:table-cell">{formatShortDate(p.nextDate)}</td>
                <td className="num px-3 py-2.5 text-right text-money">
                  {formatMoney(p.annual, income.currency, { decimals: p.annual < 10 ? 2 : 0 })}
                  {p.original && p.original.currency !== income.currency && (
                    <span className="block text-[11px] text-ink-3">{formatMoney(p.original.annual, p.original.currency, { decimals: p.original.annual < 10 ? 2 : 0 })}</span>
                  )}
                </td>
                <td className="py-2.5 pl-3 pr-5">
                  <div className="flex items-center justify-end gap-2">
                    <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-raised sm:block" aria-hidden="true">
                      <span className="block h-full rounded-full bg-sprout" style={{ width: `${Math.max(3, p.share * 100)}%` }} />
                    </span>
                    <span className="num w-11 text-right text-ink-2">{(p.share * 100).toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {income.payers.length > rows.length && (
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-ink-3">
          And {income.payers.length - rows.length} more{income.isHome ? "." : ` paying in ${currencyLabel(income.currency)}.`}
        </p>
      )}
    </Card>
  );
}

function Insights({ income, model, missing }: { income: CurrencyIncome; model: IncomeModel; missing: number }) {
  const items: { tone: "money" | "neutral" | "watch"; text: React.ReactNode }[] = [];

  // The calendar runs from today, so this month is only partly covered: leave it out
  const thisMonth = new Date().toISOString().slice(0, 7);
  const months = income.months.filter((m) => m.key !== thisMonth).slice(0, 12);
  if (months.length >= 6) {
    const low = months.reduce((a, b) => (b.total < a.total ? b : a));
    const high = months.reduce((a, b) => (b.total > a.total ? b : a));
    items.push({
      tone: "neutral",
      text: (
        <>
          <b className="font-medium text-ink">{monthName(low.key)}</b> is your quietest month (<span className="num">{formatMoney(low.total, income.currency)}</span>),{" "}
          <b className="font-medium text-ink">{monthName(high.key)}</b> the busiest (<span className="num">{formatMoney(high.total, income.currency)}</span>).
        </>
      ),
    });
  }

  const top = income.payers[0];
  if (top && income.payers.length > 1) {
    const pct = top.share * 100;
    items.push({
      tone: pct >= 30 ? "watch" : "neutral",
      text:
        pct >= 30 ? (
          <>
            <b className="num font-medium text-ink">{top.ticker}</b> pays <span className="num">{pct.toFixed(0)}%</span> of your {income.isHome ? "" : `${currencyLabel(income.currency)} `}income. A cut there would be felt.
          </>
        ) : (
          <>
            Your biggest payer, <b className="num font-medium text-ink">{top.ticker}</b>, is <span className="num">{pct.toFixed(0)}%</span> of your {income.isHome ? "" : `${currencyLabel(income.currency)} `}income
            {pct < 15 ? ", so no single cut would hit hard." : "."}
          </>
        ),
    });
  }

  const monthly = income.payers.filter((p) => p.frequency === "monthly").length;
  if (monthly > 0) {
    items.push({
      tone: "money",
      text: (
        <>
          <span className="num">{monthly}</span> {monthly === 1 ? "holding pays" : "holdings pay"} every month.
        </>
      ),
    });
  }

  if (missing > 0) {
    items.push({
      tone: "watch",
      text: (
        <>
          <span className="num">{missing}</span> of your stocks are still waiting for data, so these numbers may be low.{" "}
          <Link href="/dashboard/data/" className="text-ink underline-offset-2 hover:underline">See progress</Link>
        </>
      ),
    });
  }

  if (model.nonPayers.length > 0) {
    items.push({
      tone: "neutral",
      text: (
        <>
          <span className="num">{model.nonPayers.slice(0, 3).join(", ")}</span>
          {model.nonPayers.length > 3 && ` and ${model.nonPayers.length - 3} more`} {model.nonPayers.length === 1 ? "hasn't" : "haven't"} paid a dividend in the last three years.
        </>
      ),
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Worth knowing</CardTitle>
      </CardHeader>
      <ul className="space-y-3 px-5 pb-5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-ink-2">
            <span
              aria-hidden="true"
              className={cn(
                "mt-[7px] size-1.5 shrink-0 rounded-full",
                item.tone === "money" ? "bg-sprout" : item.tone === "watch" ? "bg-watch" : "bg-ink-3"
              )}
            />
            <span>{item.text}</span>
          </li>
        ))}
        {items.length === 0 && <li className="text-[13px] text-ink-3">Nothing to flag right now.</li>}
      </ul>
    </Card>
  );
}

function HomeSkeleton({ bare = false }: { bare?: boolean }) {
  return (
    <div className="space-y-6">
      {!bare && (
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-[340px] rounded-xl" />
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
    </div>
  );
}

export default function IncomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <IncomeContent />
    </Suspense>
  );
}

