"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import {
  AlertTriangle, Check, Download, FileBarChart, FolderPlus, Info, Layers, MoreHorizontal, Pencil, Plus, Trash2, Upload, X,
} from "lucide-react";
import { useInvestments } from "@/lib/hooks/useInvestments";
import { usePortfolioAnalysis } from "@/lib/hooks/usePortfolioAnalysis";
import { usePortfolios } from "@/lib/hooks/usePortfolios";
import { useUserPreferences } from "@/lib/hooks/useUserPreferences";
import { useHomeCurrency, usePortfolioCost } from "@/lib/fx";
import { useAppActions } from "@/components/layout/AppActions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { Chip, Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PortfolioCharts } from "@/components/charts/PortfolioCharts";
import { DiversificationCharts } from "@/components/charts/DiversificationCharts";
import { currencyLabel, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FxRates, InvestmentItem, Portfolio, PortfolioAnalysisResponse, PortfolioCost } from "@/lib/types";
import { EditInvestmentDialog } from "./EditInvestmentDialog";
import { AddHoldingDialog } from "./AddHoldingDialog";
import { DeletePortfolioDialog, type DeletePortfolioChoice } from "./DeletePortfolioDialog";
import { HoldingsTable } from "./HoldingsTable";
import { HOME_MODE, HomeCurrencyHint, homeOption, sameCurrency } from "./homeCurrency";

const MAX_PORTFOLIOS = 4;

// SWR keys that depend on holdings: refetch them all after any change
const HOLDING_KEYS = new Set(["investments", "portfolio-analysis", "portfolio-cost", "income-calendar", "portfolios"]);
const isHoldingKey = (key: unknown) =>
  (typeof key === "string" && HOLDING_KEYS.has(key)) || (Array.isArray(key) && HOLDING_KEYS.has(key[0]));

interface InvestmentsViewProps {
  portfolioId?: number;
}

export function InvestmentsView({ portfolioId }: InvestmentsViewProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { items, isLoading, remove, move, update } = useInvestments(portfolioId);
  // Each stock in its own currency (the table's per-stock figures), and, once there's a home
  // currency with rates, everything converted into it (each amount at the rate on its date)
  const { data: analysis, isLoading: analysisLoading } = usePortfolioAnalysis(items.length > 0, portfolioId);
  const { home, fx, canConvert } = useHomeCurrency();
  const {
    data: homeAnalysisRaw,
    isLoading: homeLoading,
    error: homeError,
  } = usePortfolioAnalysis(items.length > 0 && canConvert, portfolioId, canConvert ? home : null);
  const cost = usePortfolioCost(canConvert ? home : null, portfolioId);
  const homeAnalysis = homeAnalysisRaw?.converted ? homeAnalysisRaw : null;
  // The server couldn't convert after all (no rates for it yet): show one currency at a time
  const homeAvailable = canConvert && !!home && !homeError && !(homeAnalysisRaw && !homeAnalysisRaw.converted);
  const { portfolios, isLoading: portfoliosLoading, create: createPortfolio, rename: renamePortfolio, remove: removePortfolio } = usePortfolios();
  const { preferences } = useUserPreferences();
  const { openImport, exportExcel, downloadReport } = useAppActions();

  const isConsolidated = portfolioId == null;
  const currentPortfolio = portfolioId != null ? portfolios.find((p) => p.id === portfolioId) : undefined;
  const refreshAll = () => mutate(isHoldingKey);

  // ── Dialogs ────────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentItem | null>(null);
  const [deleting, setDeleting] = useState<Portfolio | null>(null);
  const [busy, setBusy] = useState<"export" | "report" | null>(null);

  // The ⌘K palette can link here with ?add=1 to open the form straight away
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") === "1") {
      setAddOpen(true);
      params.delete("add");
      const rest = params.toString();
      router.replace(`${window.location.pathname}${rest ? `?${rest}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rename ─────────────────────────────────────────────────────────────
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  // A menu returns focus to its button when it closes; skip that when it opened the rename field
  const keepFocus = useRef(false);
  useEffect(() => {
    if (isRenaming) renameInputRef.current?.select();
  }, [isRenaming]);
  useEffect(() => setIsRenaming(false), [portfolioId]);

  const startRename = () => {
    if (!currentPortfolio) return;
    setRenameValue(currentPortfolio.name);
    setIsRenaming(true);
  };
  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && portfolioId && trimmed !== currentPortfolio?.name) await renamePortfolio(portfolioId, trimmed);
    setIsRenaming(false);
  };

  // Either analysis knows each stock's market and currency; use whichever arrived
  const base = analysis ?? homeAnalysisRaw;

  // ── Filters ────────────────────────────────────────────────────────────
  const [exchange, setExchange] = useState<string | null>(null);
  const exchanges = useMemo(
    () => (base?.exchange_map ? Array.from(new Set(Object.values(base.exchange_map))).sort() : []),
    [base]
  );
  useEffect(() => {
    if (exchange && !exchanges.includes(exchange)) setExchange(null);
  }, [exchange, exchanges]);

  // Holdings grouped by ticker, across portfolios on the all-portfolios page
  const groups = useMemo(() => {
    const map = new Map<string, InvestmentItem[]>();
    for (const item of items) {
      if (exchange && base?.exchange_map?.[item.ticker_symbol] !== exchange) continue;
      const list = map.get(item.ticker_symbol) ?? [];
      list.push(item);
      map.set(item.ticker_symbol, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ticker, lots]) => ({ ticker, lots }));
  }, [items, exchange, base]);

  // ── Currency: all in the home currency, or one currency at a time ──────
  // Stocks grouped by their market's currency, most stocks first
  const byCurrency = useMemo(() => {
    const map = new Map<string, string[]>();
    const last = base?.data_points[base.data_points.length - 1];
    if (!last) return map;
    for (const t of Object.keys(last.stock_values)) {
      if (exchange && base!.exchange_map[t] !== exchange) continue;
      const cur = base!.currency_map?.[t] ?? base!.currency ?? "USD";
      map.set(cur, [...(map.get(cur) ?? []), t]);
    }
    return new Map(Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])));
  }, [base, exchange]);
  const currencies = Array.from(byCurrency.keys());
  const [pickedCurrency, setPickedCurrency] = useState<string | null>(null);
  const homeMode =
    homeAvailable && (pickedCurrency == null || pickedCurrency === HOME_MODE || !byCurrency.has(pickedCurrency));
  const singleCurrency = pickedCurrency && byCurrency.has(pickedCurrency) ? pickedCurrency : currencies[0];
  // Why a return that crosses currencies can't be shown in this mode
  const crossCurrencyHint = homeMode
    ? undefined
    : homeAvailable
      ? `Choose "All in ${currencyLabel(home)}" above to see it with exchange rates.`
      : home
        ? "It appears once the exchange rates have downloaded."
        : "Set a home currency in Settings to see it with exchange rates.";

  const stockCount = useMemo(() => new Set(items.map((i) => i.ticker_symbol)).size, [items]);

  // ── Actions ────────────────────────────────────────────────────────────
  const handleRemove = async (id: number) => {
    await remove(id);
    refreshAll();
  };
  const handleMove = async (lotId: number, targetId: number) => {
    await move(lotId, targetId);
    refreshAll();
  };
  const handleUpdate = async (
    id: number,
    updates: { quantity?: number; purchase_price?: number; purchase_date?: string; purchase_currency?: string }
  ) => {
    await update(id, updates);
    refreshAll();
  };
  const runBusy = async (key: "export" | "report", fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  const handleDeletePortfolio = async (choice: DeletePortfolioChoice) => {
    if (!deleting) return;
    const id = deleting.id;
    if (choice.action === "move") {
      for (const lot of items.filter((i) => i.portfolio_id === id)) await move(lot.id, choice.targetId);
    }
    await removePortfolio(id);
    refreshAll();
    if (portfolioId === id) router.push("/dashboard/investments/");
  };

  const canDeleteCurrent = !!currentPortfolio && portfolios.length > 1;
  const title = isConsolidated ? "Holdings" : currentPortfolio?.name ?? (portfoliosLoading ? "Portfolio" : "Portfolio not found");

  // ── Header ─────────────────────────────────────────────────────────────
  const header = (
    <PageHeader
      eyebrow={isConsolidated ? (portfolios.length > 1 ? "All portfolios" : undefined) : "Portfolio"}
      title={
        isRenaming ? (
          <span className="flex items-center gap-1.5">
            <Input
              ref={renameInputRef}
              aria-label="Portfolio name"
              maxLength={60}
              className="h-10 w-[min(20rem,70vw)] text-[18px] font-semibold"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setIsRenaming(false);
              }}
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Save name" onClick={handleRename}>
              <Check className="size-4 text-sprout" />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Cancel renaming" onClick={() => setIsRenaming(false)}>
              <X className="size-4" />
            </Button>
          </span>
        ) : (
          <span className="inline-flex max-w-full items-center gap-1.5">
            <span className="truncate">{title}</span>
            {currentPortfolio && (
              <Button variant="ghost" size="icon" className="size-8 shrink-0 text-ink-3" aria-label="Rename portfolio" onClick={startRename}>
                <Pencil className="size-3.5" />
              </Button>
            )}
          </span>
        )
      }
      description={
        items.length > 0 ? (
          <>
            <span className="num">{stockCount}</span> stock{stockCount === 1 ? "" : "s"} ·{" "}
            <span className="num">{items.length}</span> lot{items.length === 1 ? "" : "s"}
            {isConsolidated && portfolios.length > 1 && (
              <>
                {" "}across <span className="num">{portfolios.length}</span> portfolios
              </>
            )}
            . Values use the prices stored on this computer.
          </>
        ) : undefined
      }
      actions={
        <>
          <Button onClick={() => setAddOpen(true)} disabled={!isConsolidated && !currentPortfolio}>
            <Plus className="size-4" />
            Add holding
          </Button>
          <Button variant="outline" onClick={openImport}>
            <Upload className="size-4" />
            Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-52"
              onCloseAutoFocus={(e) => {
                if (keepFocus.current) {
                  e.preventDefault();
                  keepFocus.current = false;
                }
              }}
            >
              <DropdownMenuItem disabled={busy === "export"} onSelect={() => runBusy("export", exportExcel)}>
                <Download /> {busy === "export" ? "Exporting…" : "Export to Excel"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy === "report" || items.length === 0}
                onSelect={() => runBusy("report", () => downloadReport(portfolioId))}
              >
                <FileBarChart /> {busy === "report" ? "Preparing report…" : "Download report"}
              </DropdownMenuItem>
              {isConsolidated && portfolios.length < MAX_PORTFOLIOS && (
                <DropdownMenuItem onSelect={() => createPortfolio(`Portfolio ${portfolios.length + 1}`)}>
                  <FolderPlus /> New portfolio
                </DropdownMenuItem>
              )}
              {currentPortfolio && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      keepFocus.current = true;
                      startRename();
                    }}
                  >
                    <Pencil /> Rename portfolio
                  </DropdownMenuItem>
                  {canDeleteCurrent && (
                    <DropdownMenuItem onSelect={() => setDeleting(currentPortfolio)} className="text-cut focus:bg-cut/10 focus:text-cut">
                      <Trash2 /> Delete portfolio
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    />
  );

  const dialogs = (
    <>
      <AddHoldingDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        portfolios={portfolios}
        defaultPortfolioId={portfolioId}
        onAdded={refreshAll}
      />
      {editing && (
        <EditInvestmentDialog
          key={editing.id}
          investment={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          onSave={handleUpdate}
        />
      )}
      <DeletePortfolioDialog
        portfolio={deleting}
        portfolios={portfolios}
        lotCount={deleting ? items.filter((i) => i.portfolio_id === deleting.id).length : 0}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={handleDeletePortfolio}
      />
    </>
  );

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <StatSkeletons />
        <Card>
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </Card>
        {dialogs}
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        {isConsolidated && portfolios.length > 1 && <PortfolioStrip portfolios={portfolios} items={items} onDelete={setDeleting} onReport={downloadReport} />}
        <EmptyState
          icon={<Layers />}
          title={
            isConsolidated ? (
              <>
                Add your first <span className="serif-accent text-[18px]">holding</span>
              </>
            ) : (
              "This portfolio is empty"
            )
          }
          description={
            isConsolidated
              ? "Import a spreadsheet of your purchases, or add them one at a time. Prices and dividends are then fetched by this computer."
              : "Add a purchase, import a spreadsheet, or move lots here from another portfolio."
          }
          action={
            <>
              <Button onClick={() => setAddOpen(true)} disabled={!isConsolidated && !currentPortfolio}>
                <Plus className="size-4" />
                Add holding
              </Button>
              <Button variant="outline" onClick={openImport}>
                <Upload className="size-4" />
                Import from Excel
              </Button>
            </>
          }
        />
        {dialogs}
      </div>
    );
  }

  const noPrices = base != null && base.data_points.length === 0;
  // The charts get the converted analysis in home mode (totals and weights in one currency)
  const chartData = homeMode ? homeAnalysis : analysis;
  const chartLoading = homeMode ? homeLoading : analysisLoading;

  return (
    <div className="space-y-6">
      {header}

      {isConsolidated && portfolios.length > 1 && (
        <PortfolioStrip portfolios={portfolios} items={items} onDelete={setDeleting} onReport={downloadReport} />
      )}

      {exchanges.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by market">
          <Chip active={exchange === null} onClick={() => setExchange(null)}>
            All markets
          </Chip>
          {exchanges.map((ex) => (
            <Chip key={ex} active={exchange === ex} onClick={() => setExchange(ex)}>
              <span className="font-mono text-[11.5px]">{ex}</span>
            </Chip>
          ))}
        </div>
      )}

      {!base ? (
        analysisLoading || homeLoading ? <StatSkeletons /> : null
      ) : !noPrices ? (
        <PortfolioSummary
          analysis={analysis}
          homeAnalysis={homeMode ? homeAnalysis : null}
          cost={homeMode ? cost : undefined}
          byCurrency={byCurrency}
          mode={homeMode ? HOME_MODE : singleCurrency}
          onPick={setPickedCurrency}
          home={home}
          fx={fx}
          canConvert={canConvert}
          homeAvailable={homeAvailable}
        />
      ) : null}

      {noPrices && (
        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-raised px-4 py-3 text-[13px] text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Prices and dividends for these stocks aren&apos;t on this computer yet. They&apos;re fetched in the background;{" "}
            <Link href="/dashboard/data/" className="text-sprout underline-offset-4 hover:underline">
              the Data page
            </Link>{" "}
            shows progress.
          </p>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-baseline justify-between gap-3 border-b border-line">
          <div className="space-y-1">
            <CardTitle>Holdings</CardTitle>
            <CardDescription>Click a stock to see each purchase, then edit, move or delete it.</CardDescription>
          </div>
          {exchange && (
            <span className="shrink-0 text-[12.5px] text-ink-3">
              Showing <span className="font-mono text-ink-2">{exchange}</span>
            </span>
          )}
        </CardHeader>
        <HoldingsTable
          groups={groups}
          analysis={analysis}
          analysisLoading={analysisLoading}
          home={homeMode ? home : null}
          homeAnalysis={homeMode ? homeAnalysis : null}
          homeCost={homeMode ? cost : undefined}
          crossCurrencyHint={crossCurrencyHint}
          portfolios={portfolios}
          showPortfolio={isConsolidated && portfolios.length > 1}
          dateFormat={preferences.date_format}
          onEdit={setEditing}
          onMove={handleMove}
          onRemove={handleRemove}
        />
      </Card>

      {!noPrices && (
        <>
          <PortfolioCharts
            data={chartData}
            isLoading={chartLoading}
            exchangeFilter={exchange}
            exchangeMap={chartData?.exchange_map ?? {}}
            currencyMap={chartData?.currency_map ?? {}}
          />
          {chartData && <DiversificationCharts data={chartData} exchangeFilter={exchange} />}
        </>
      )}

      {dialogs}
    </div>
  );
}

// ── KPI row ─────────────────────────────────────────────────────────────────

function StatSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[104px] rounded-xl" />
      ))}
    </div>
  );
}

type DataPoint = PortfolioAnalysisResponse["data_points"][0];

const sumOf = (tickers: string[], values: Record<string, number>) => tickers.reduce((s, t) => s + (values[t] ?? 0), 0);

/** Totals for stocks in one currency, each amount in that stock's own currency. */
function computeStats(tickers: string[], analysis: PortfolioAnalysisResponse, lastPoint: DataPoint) {
  const currentValue = sumOf(tickers, lastPoint.stock_values);
  const dividends = sumOf(tickers, lastPoint.stock_dividends);
  const invested = analysis.investments
    .filter((inv) => tickers.includes(inv.ticker_symbol))
    .reduce((s, inv) => s + inv.quantity * (inv.purchase_price ?? 0), 0);
  return { currentValue, dividends, invested };
}

/**
 * Totals in the home currency: what the lots cost at their purchase-date rates, and value and
 * dividends from the converted analysis (each at the rate on its own date).
 */
function computeHomeStats(tickers: string[], homeAnalysis: PortfolioAnalysisResponse, cost: PortfolioCost) {
  const lastPoint = homeAnalysis.data_points[homeAnalysis.data_points.length - 1];
  return {
    currentValue: lastPoint ? sumOf(tickers, lastPoint.stock_values) : 0,
    dividends: lastPoint ? sumOf(tickers, lastPoint.stock_dividends) : 0,
    // Only stocks that have a value, so the return compares like with like
    invested: sumOf(tickers, cost.by_ticker),
  };
}

function PortfolioSummary({
  analysis,
  homeAnalysis,
  cost,
  byCurrency,
  mode,
  onPick,
  home,
  fx,
  canConvert,
  homeAvailable,
}: {
  analysis: PortfolioAnalysisResponse | null;
  /** The converted analysis, in home mode only */
  homeAnalysis: PortfolioAnalysisResponse | null;
  cost: PortfolioCost | undefined;
  /** Shown stocks by their market's currency, most stocks first */
  byCurrency: Map<string, string[]>;
  /** HOME_MODE, or the one currency whose stocks are totalled */
  mode: string | undefined;
  onPick: (value: string) => void;
  home: string | null;
  fx: FxRates | undefined;
  canConvert: boolean;
  homeAvailable: boolean;
}) {
  const currencies = Array.from(byCurrency.keys());
  if (!mode || currencies.length === 0) return null;

  const homeMode = mode === HOME_MODE && !!home;
  const mixed = currencies.length > 1;
  // A picker when there's more than one way to show the totals
  const showPicker = homeAvailable && home ? mixed || !sameCurrency(currencies[0], home) : mixed;
  const currency = homeMode ? home! : mode;
  const tickers = homeMode ? currencies.flatMap((c) => byCurrency.get(c) ?? []) : byCurrency.get(mode) ?? [];

  const nativeLast = analysis?.data_points[analysis.data_points.length - 1];
  const s =
    homeMode
      ? homeAnalysis && cost
        ? computeHomeStats(tickers, homeAnalysis, cost)
        : null
      : analysis && nativeLast
        ? computeStats(tickers, analysis, nativeLast)
        : null;

  const unconverted = homeMode
    ? Array.from(new Set([...(homeAnalysis?.unconverted_currencies ?? []), ...(cost?.unconverted_currencies ?? [])]))
        .map(currencyLabel)
        .sort()
    : [];
  const unpriced = homeMode ? cost?.lots_without_price ?? 0 : 0;
  // The conversion note matters only when something is in another currency than home
  const anyConverted =
    showPicker || Object.values(homeAnalysis?.purchase_currency_map ?? {}).some((c) => c && !sameCurrency(c, home));

  return (
    <section aria-label="Summary" className="space-y-3">
      {showPicker && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] text-ink-3">
            {mixed ? (
              <>
                Your stocks trade in <span className="num">{currencies.length}</span> currencies
              </>
            ) : (
              <>
                Your stocks trade in <span className="font-mono">{currencyLabel(currencies[0])}</span>
              </>
            )}
            {homeMode ? (
              <>
                , shown here in <span className="font-mono">{currencyLabel(home)}</span>.
              </>
            ) : mixed ? (
              ". Totals are shown one currency at a time."
            ) : (
              "."
            )}
            {mixed && !canConvert && (
              <>
                {" "}
                <HomeCurrencyHint home={home} fx={fx} canConvert={canConvert} />
              </>
            )}
          </p>
          <Segmented
            aria-label="Currency"
            value={homeMode ? HOME_MODE : mode}
            onChange={onPick}
            options={[
              ...(homeAvailable && home ? [homeOption(home)] : []),
              ...currencies.map((c) => ({
                value: c,
                label: (
                  <span className="font-mono">
                    {currencyLabel(c)} <span className="text-ink-3">{byCurrency.get(c)!.length}</span>
                  </span>
                ),
                title: `${byCurrency.get(c)!.length} stock${byCurrency.get(c)!.length === 1 ? "" : "s"} in ${currencyLabel(c)}`,
              })),
            ]}
          />
        </div>
      )}

      {s ? (
        <KpiRow
          {...s}
          currency={currency}
          investedSub={
            unpriced > 0 ? (
              <>
                <span className="num">{unpriced}</span> lot{unpriced === 1 ? "" : "s"} without a price left out
              </>
            ) : (
              `What you paid, in ${currencyLabel(currency)}`
            )
          }
          valueSub={`${tickers.length} stock${tickers.length === 1 ? "" : "s"}${showPicker && !homeMode ? ` in ${currencyLabel(currency)}` : ""}`}
        />
      ) : (
        <StatSkeletons />
      )}

      {homeMode && (anyConverted || unconverted.length > 0) && (
        <div className="space-y-1 text-[12px] text-ink-3">
          {anyConverted && (
            <p>
              Converted with European Central Bank rates: past amounts at the rate on their date, today&apos;s values at
              today&apos;s rate.
            </p>
          )}
          {unconverted.length > 0 && (
            <p className="flex items-start gap-1.5 text-watch">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>
                No exchange rate for <span className="font-mono">{unconverted.join(", ")}</span>, so those amounts are left in
                their own currency.
              </span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function KpiRow({
  invested,
  currentValue,
  dividends,
  currency,
  investedSub,
  valueSub,
}: {
  invested: number;
  currentValue: number;
  dividends: number;
  currency: string;
  investedSub: React.ReactNode;
  valueSub: React.ReactNode;
}) {
  const gain = invested > 0 ? currentValue + dividends - invested : 0;
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
  const up = gain >= 0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Invested" value={formatMoney(invested, currency)} sub={investedSub} />
      <Stat label="Current value" value={formatMoney(currentValue, currency)} sub={valueSub} />
      <Stat label="Dividends received" tone="money" value={formatMoney(dividends, currency)} sub="Since you bought" />
      <Stat
        label="Total return"
        value={
          invested > 0 ? (
            <span className={cn(up ? "text-money" : "text-cut")}>
              <span aria-hidden="true" className="mr-1.5 text-[0.62em] align-middle">{up ? "▲" : "▼"}</span>
              {up ? "+" : "−"}
              {formatMoney(Math.abs(gain), currency)}
            </span>
          ) : (
            <span className="text-ink-3">—</span>
          )
        }
        sub={
          invested > 0 ? (
            <>
              <span className={cn("num", up ? "text-money" : "text-cut")}>
                {up ? "+" : "−"}
                {Math.abs(gainPct).toFixed(1)}%
              </span>{" "}
              including dividends
            </>
          ) : (
            "Add purchase prices to see it"
          )
        }
      />
    </div>
  );
}

// ── Portfolio cards on the all-portfolios page ──────────────────────────────

function PortfolioStrip({
  portfolios,
  items,
  onDelete,
  onReport,
}: {
  portfolios: Portfolio[];
  items: InvestmentItem[];
  onDelete: (p: Portfolio) => void;
  onReport: (portfolioId?: number) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {portfolios.map((p) => {
        const lots = items.filter((i) => i.portfolio_id === p.id);
        const stocks = new Set(lots.map((l) => l.ticker_symbol)).size;
        return (
          <div
            key={p.id}
            className="group relative flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card transition-colors hover:border-line-strong"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/dashboard/investments/portfolio/?id=${p.id}`}
                className="block truncate text-[14px] font-medium text-ink after:absolute after:inset-0 after:content-['']"
              >
                {p.name}
              </Link>
              <p className="text-[12px] text-ink-3">
                {lots.length === 0 ? (
                  "Empty"
                ) : (
                  <>
                    <span className="num">{stocks}</span> stock{stocks === 1 ? "" : "s"} · <span className="num">{lots.length}</span> lot
                    {lots.length === 1 ? "" : "s"}
                  </>
                )}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative z-10 size-8 text-ink-3" aria-label={`Actions for ${p.name}`}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/investments/portfolio/?id=${p.id}`}>
                    <Layers /> Open
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem disabled={lots.length === 0} onSelect={() => onReport(p.id)}>
                  <FileBarChart /> Download report
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDelete(p)} className="text-cut focus:bg-cut/10 focus:text-cut">
                  <Trash2 /> Delete portfolio
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
