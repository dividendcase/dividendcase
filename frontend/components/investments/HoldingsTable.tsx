"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronRight, MoreHorizontal, Pencil, Trash2, ArrowRightLeft } from "lucide-react";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TickerBadge } from "@/components/ui/ticker-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { currencyLabel, formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/utils/formatDate";
import { cn } from "@/lib/utils";
import type { InvestmentItem, Portfolio, PortfolioAnalysisResponse, PortfolioCost } from "@/lib/types";
import { stockHref, useStockDetail } from "./stockDetail";
import { sameCurrency } from "./homeCurrency";

/** In home mode: the home currency with the converted analysis and purchase-date costs. */
interface HomeFigures {
  home: string;
  analysis: PortfolioAnalysisResponse | null;
  cost: PortfolioCost | undefined;
}

interface HoldingsTableProps {
  groups: { ticker: string; lots: InvestmentItem[] }[];
  /** Each stock in its own currency */
  analysis: PortfolioAnalysisResponse | null;
  analysisLoading: boolean;
  /** Set in home mode: converted values show under each stock's own */
  home?: string | null;
  homeAnalysis?: PortfolioAnalysisResponse | null;
  homeCost?: PortfolioCost;
  /** Why a return across two currencies isn't shown, outside home mode */
  crossCurrencyHint?: string;
  portfolios: Portfolio[];
  /** On the all-portfolios page each lot shows which portfolio it's in */
  showPortfolio: boolean;
  dateFormat: string;
  onEdit: (lot: InvestmentItem) => void;
  onMove: (lotId: number, targetPortfolioId: number) => void;
  onRemove: (lotId: number) => void;
}

const COLUMNS = 7;

/** A gain or loss: arrow, sign and colour, so colour is never the only signal. */
export function Change({ amount, pct, currency, className }: { amount: number; pct?: number; currency?: string; className?: string }) {
  const up = amount >= 0;
  return (
    <span className={cn("num inline-flex flex-col items-end leading-tight", up ? "text-money" : "text-cut", className)}>
      <span>
        <span aria-hidden="true" className="mr-1 text-[0.8em]">{up ? "▲" : "▼"}</span>
        {up ? "+" : "−"}
        {formatMoney(Math.abs(amount), currency, { decimals: 0 })}
      </span>
      {pct != null && (
        <span className="text-[11.5px] opacity-80">
          {up ? "+" : "−"}
          {Math.abs(pct).toFixed(1)}%
        </span>
      )}
    </span>
  );
}

export function HoldingsTable({
  groups,
  analysis,
  analysisLoading,
  home,
  homeAnalysis,
  homeCost,
  crossCurrencyHint,
  portfolios,
  showPortfolio,
  dateFormat,
  onEdit,
  onMove,
  onRemove,
}: HoldingsTableProps) {
  const homeFigures: HomeFigures | null = home ? { home, analysis: homeAnalysis ?? null, cost: homeCost } : null;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (ticker: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });

  return (
    <Table className="min-w-[780px]">
      <THead>
        <tr>
          <TH>Stock</TH>
          <TH numeric>Shares</TH>
          <TH numeric>Avg cost</TH>
          <TH numeric title="Price on the latest dividend date">Price</TH>
          <TH numeric>Value</TH>
          <TH numeric>Dividends</TH>
          <TH numeric title="Value plus dividends, minus what you paid">Total return</TH>
        </tr>
      </THead>
      <TBody>
        {groups.map(({ ticker, lots }) => (
          <HoldingRow
            key={ticker}
            ticker={ticker}
            lots={lots}
            analysis={analysis}
            analysisLoading={analysisLoading}
            homeFigures={homeFigures}
            crossCurrencyHint={crossCurrencyHint}
            portfolios={portfolios}
            showPortfolio={showPortfolio}
            dateFormat={dateFormat}
            isExpanded={expanded.has(ticker)}
            onToggle={() => toggle(ticker)}
            onEdit={onEdit}
            onMove={onMove}
            onRemove={onRemove}
          />
        ))}
      </TBody>
    </Table>
  );
}

function HoldingRow({
  ticker,
  lots,
  analysis,
  analysisLoading,
  homeFigures,
  crossCurrencyHint,
  portfolios,
  showPortfolio,
  dateFormat,
  isExpanded,
  onToggle,
  onEdit,
  onMove,
  onRemove,
}: {
  ticker: string;
  lots: InvestmentItem[];
  analysis: PortfolioAnalysisResponse | null;
  analysisLoading: boolean;
  homeFigures: HomeFigures | null;
  crossCurrencyHint?: string;
  portfolios: Portfolio[];
  showPortfolio: boolean;
  dateFormat: string;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (lot: InvestmentItem) => void;
  onMove: (lotId: number, targetPortfolioId: number) => void;
  onRemove: (lotId: number) => void;
}) {
  const { detail } = useStockDetail(ticker);

  const totalShares = lots.reduce((s, l) => s + l.quantity, 0);
  const lotsWithPrice = lots.filter((l) => l.purchase_price != null);
  const pricedShares = lotsWithPrice.reduce((s, l) => s + l.quantity, 0);
  const investedValue = lotsWithPrice.reduce((s, l) => s + l.quantity * (l.purchase_price ?? 0), 0);
  const avgPrice = pricedShares > 0 ? investedValue / pricedShares : null;

  const marketCurrency = analysis?.currency_map?.[ticker] ?? detail?.currency ?? undefined;
  const purchaseCurrency = analysis?.purchase_currency_map?.[ticker] || marketCurrency;
  const isCrossCurrency = !!(purchaseCurrency && marketCurrency && purchaseCurrency !== marketCurrency);
  const exchange = analysis?.exchange_map?.[ticker] ?? detail?.exchange;

  const lastPoint = analysis?.data_points?.[analysis.data_points.length - 1];
  const hasValue = lastPoint?.stock_values?.[ticker] != null;
  const currentValue = lastPoint?.stock_values?.[ticker] ?? 0;
  const dividends = lastPoint?.stock_dividends?.[ticker] ?? 0;
  const lastPrice = totalShares > 0 && hasValue ? currentValue / totalShares : null;
  const gain = !isCrossCurrency && investedValue > 0 && hasValue ? currentValue + dividends - investedValue : null;
  const gainPct = gain != null && investedValue > 0 ? (gain / investedValue) * 100 : null;

  // Home mode: the value converted, and a return that crosses currencies worked out in the home
  // currency (cost at purchase-date rates, value and dividends at the rate on their dates)
  const home = homeFigures?.home;
  const homePoints = homeFigures?.analysis?.data_points;
  const homeLast = homePoints?.[homePoints.length - 1];
  const homeValue = homeLast?.stock_values?.[ticker];
  const homeInvested = homeFigures?.cost?.by_ticker?.[ticker];
  const homeGain =
    isCrossCurrency && homeValue != null && homeInvested != null && homeInvested > 0
      ? homeValue + (homeLast?.stock_dividends?.[ticker] ?? 0) - homeInvested
      : null;
  const homeGainPct = homeGain != null && homeInvested ? (homeGain / homeInvested) * 100 : null;
  const showHomeValue = !!home && homeValue != null && !sameCurrency(marketCurrency, home);

  const pending = analysisLoading && !analysis;
  const dash = <span className="text-ink-3">—</span>;
  const cellSkeleton = <Skeleton className="ml-auto h-3.5 w-14" />;
  const portfolioName = (id?: number) => portfolios.find((p) => p.id === id)?.name ?? "—";

  return (
    <Fragment>
      <TR
        className={cn("cursor-pointer", isExpanded && "bg-raised/40")}
        onClick={onToggle}
      >
        <TD>
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Hide" : "Show"} ${lots.length} lot${lots.length === 1 ? "" : "s"} of ${ticker}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="-ml-1 rounded p-0.5 text-ink-3 transition-colors hover:bg-raised hover:text-ink"
            >
              <ChevronRight className={cn("size-4 transition-transform", isExpanded && "rotate-90")} />
            </button>
            <TickerBadge ticker={ticker} />
            <Link
              href={stockHref(ticker)}
              onClick={(e) => e.stopPropagation()}
              className="group min-w-0 max-w-[260px]"
              title={`Open ${ticker}`}
            >
              <span className="num block truncate text-[13px] font-medium text-ink group-hover:text-sprout">{ticker}</span>
              <span className="block truncate text-[12px] text-ink-3 group-hover:text-ink-2">
                {detail?.company_name ?? (exchange ? "" : " ")}
                {detail?.company_name && exchange ? " · " : ""}
                {exchange && <span className="font-mono text-[10.5px] uppercase">{exchange}</span>}
              </span>
            </Link>
          </div>
        </TD>
        <TD numeric>
          {formatShares(totalShares)}
          {lots.length > 1 && <span className="block text-[11px] text-ink-3">{lots.length} lots</span>}
        </TD>
        <TD numeric>{avgPrice != null ? formatMoney(avgPrice, purchaseCurrency, { decimals: 2 }) : dash}</TD>
        <TD numeric>{pending ? cellSkeleton : lastPrice != null ? formatMoney(lastPrice, marketCurrency, { decimals: 2 }) : dash}</TD>
        <TD numeric>
          {pending ? (
            cellSkeleton
          ) : hasValue ? (
            <>
              {formatMoney(currentValue, marketCurrency)}
              {showHomeValue && (
                <span className="block text-[11px] text-ink-3" title={`In ${currencyLabel(home)}`}>
                  {formatMoney(homeValue!, home)}
                </span>
              )}
            </>
          ) : (
            dash
          )}
        </TD>
        <TD numeric>
          {pending ? cellSkeleton : dividends > 0 ? <span className="text-money">{formatMoney(dividends, marketCurrency)}</span> : dash}
        </TD>
        <TD numeric>
          {pending ? (
            cellSkeleton
          ) : gain != null ? (
            <Change amount={gain} pct={gainPct ?? undefined} currency={marketCurrency} />
          ) : homeGain != null ? (
            <span
              title={`Bought in ${purchaseCurrency}, priced in ${marketCurrency}: worked out in ${currencyLabel(home)} with the exchange rate on each date`}
            >
              <Change amount={homeGain} pct={homeGainPct ?? undefined} currency={home} />
            </span>
          ) : isCrossCurrency ? (
            <span
              className="text-[12px] text-ink-3"
              title={`Bought in ${purchaseCurrency}, priced in ${marketCurrency}.${crossCurrencyHint ? ` ${crossCurrencyHint}` : ""}`}
            >
              {purchaseCurrency} → {marketCurrency}
            </span>
          ) : (
            dash
          )}
        </TD>
      </TR>

      {isExpanded && (
        <tr className="bg-well">
          <td colSpan={COLUMNS} className="px-4 pb-3 pt-1">
            <div className="ml-7 overflow-hidden rounded-lg border border-line">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left">
                    {["Bought", "Shares", "Price paid", "Cost", ...(showPortfolio ? ["Portfolio"] : []), ""].map((h, i) => (
                      <th
                        key={i}
                        className={cn(
                          "border-b border-line bg-surface/60 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3",
                          (h === "Shares" || h === "Price paid" || h === "Cost") && "text-right"
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lots
                    .slice()
                    .sort((a, b) => a.purchase_date.localeCompare(b.purchase_date))
                    .map((lot) => {
                      const lotCurrency = lot.purchase_currency || marketCurrency;
                      const otherPortfolios = portfolios.filter((p) => p.id !== lot.portfolio_id);
                      return (
                        <tr key={lot.id} className="border-t border-line first:border-t-0">
                          <td className="num px-3 py-1.5 text-ink-2">{formatDate(lot.purchase_date, dateFormat)}</td>
                          <td className="num px-3 py-1.5 text-right text-ink">{formatShares(lot.quantity)}</td>
                          <td className="num px-3 py-1.5 text-right text-ink">
                            {lot.purchase_price != null ? formatMoney(lot.purchase_price, lotCurrency, { decimals: 2 }) : dash}
                            {lot.purchase_currency && lot.purchase_currency !== marketCurrency && (
                              <span className="ml-1.5 rounded bg-raised px-1 py-px text-[10px] text-ink-2">{lot.purchase_currency}</span>
                            )}
                          </td>
                          <td className="num px-3 py-1.5 text-right text-ink-2">
                            {lot.purchase_price != null ? formatMoney(lot.purchase_price * lot.quantity, lotCurrency) : dash}
                          </td>
                          {showPortfolio && <td className="px-3 py-1.5 text-ink-2">{portfolioName(lot.portfolio_id)}</td>}
                          <td className="w-10 px-2 py-1 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-7" aria-label={`Actions for the lot bought ${lot.purchase_date}`}>
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-44">
                                <DropdownMenuItem onSelect={() => onEdit(lot)}>
                                  <Pencil /> Edit lot
                                </DropdownMenuItem>
                                {otherPortfolios.length > 0 && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="flex items-center gap-1.5">
                                      <ArrowRightLeft className="size-3" /> Move to
                                    </DropdownMenuLabel>
                                    {otherPortfolios.map((p) => (
                                      <DropdownMenuItem key={p.id} onSelect={() => onMove(lot.id, p.id)}>
                                        {p.name}
                                      </DropdownMenuItem>
                                    ))}
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => onRemove(lot.id)} className="text-cut focus:bg-cut/10 focus:text-cut">
                                  <Trash2 /> Delete lot
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function formatShares(n: number): string {
  return n.toLocaleString("en", { maximumFractionDigits: 4 });
}
