"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import {
  ArrowRight, BarChart3, Bookmark, Bug, CalendarDays, Lightbulb, Database, Download, FileSpreadsheet,
  GitCompareArrows, Info, Layers, Loader2, RefreshCw, Search, Settings, SlidersHorizontal, Sprout, Upload,
} from "lucide-react";
import { useStockSearch } from "@/lib/hooks/useStockSearch";
import { useInvestments } from "@/lib/hooks/useInvestments";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import { useDataStatus } from "@/lib/hooks/useDataStatus";
import { TickerBadge } from "@/components/ui/ticker-badge";
import { useAppInfo } from "@/lib/hooks/useAppInfo";
import { bugReportUrl, ideaUrl } from "@/lib/feedback";

export const PAGES = [
  { href: "/dashboard/", label: "Income", hint: "Home", Icon: BarChart3, keywords: "home dashboard overview" },
  { href: "/dashboard/investments/", label: "Holdings", hint: "Portfolios", Icon: Layers, keywords: "portfolio investments lots" },
  { href: "/dashboard/calendar/", label: "Calendar", hint: "Upcoming payments", Icon: CalendarDays, keywords: "income schedule payments" },
  { href: "/dashboard/screener/", label: "Screener", hint: "Find dividend stocks", Icon: SlidersHorizontal, keywords: "stocks top filter yield" },
  { href: "/dashboard/watchlist/", label: "Watchlists", hint: "", Icon: Bookmark, keywords: "saved" },
  { href: "/dashboard/compare/", label: "Compare", hint: "Up to four stocks", Icon: GitCompareArrows, keywords: "side by side" },
  { href: "/dashboard/drip/", label: "DRIP calculator", hint: "Reinvesting", Icon: Sprout, keywords: "reinvest compound growth" },
  { href: "/dashboard/data/", label: "Data", hint: "Updates from Yahoo Finance", Icon: Database, keywords: "refresh fetch status" },
  { href: "/dashboard/settings/", label: "Settings", hint: "", Icon: Settings, keywords: "preferences delete" },
  { href: "/dashboard/about/", label: "About", hint: "", Icon: Info, keywords: "help methodology" },
] as const;

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: () => void;
  onExport: () => Promise<void>;
  onReport: () => Promise<void>;
}

const itemClass =
  "group flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] text-ink-2 outline-none data-[selected=true]:bg-raised data-[selected=true]:text-ink [&_svg]:size-4 [&_svg]:shrink-0";
const groupClass =
  "px-2 pb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-3";

function matches(q: string, ...fields: string[]) {
  const needle = q.trim().toLowerCase();
  return !needle || fields.some((f) => f.toLowerCase().includes(needle));
}

export function CommandPalette({ open, onOpenChange, onImport, onExport, onReport }: CommandPaletteProps) {
  const router = useRouter();
  const { query, setQuery, results, isSearching } = useStockSearch();
  const { items: holdings } = useInvestments();
  const { items: watchlist } = useWatchlist();
  const { startRefresh } = useDataStatus();
  const { info: appInfo } = useAppInfo();
  const [busy, setBusy] = useState<string | null>(null);

  // ⌘K / Ctrl+K anywhere; "/" when not typing in a field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open, setQuery]);

  const yourTickers = useMemo(() => {
    const held = new Set(holdings.map((h) => h.ticker_symbol));
    const watched = watchlist.map((w) => w.ticker_symbol).filter((t) => !held.has(t));
    return [
      ...Array.from(held).map((t) => ({ ticker: t, kind: "Holding" })),
      ...Array.from(new Set(watched)).map((t) => ({ ticker: t, kind: "Watchlist" })),
    ];
  }, [holdings, watchlist]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const openStock = (ticker: string) => go(`/dashboard/stock/?t=${encodeURIComponent(ticker)}`);

  const run = async (key: string, fn: () => Promise<void> | void) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
      onOpenChange(false);
    }
  };

  const actions = [
    { key: "import", label: "Import holdings from Excel", Icon: Upload, keywords: "xlsx upload spreadsheet", fn: onImport },
    { key: "add", label: "Add a holding", Icon: Layers, keywords: "buy new investment lot", fn: () => go("/dashboard/investments/?add=1") },
    { key: "export", label: "Export everything to Excel", Icon: Download, keywords: "backup xlsx download", fn: onExport },
    { key: "report", label: "Download income report", Icon: FileSpreadsheet, keywords: "xlsx summary", fn: onReport },
    { key: "refresh", label: "Refresh my stocks now", Icon: RefreshCw, keywords: "update fetch yahoo data", fn: () => startRefresh("holdings", true) },
    { key: "bug", label: "Report a problem", Icon: Bug, keywords: "bug issue feedback broken wrong github", fn: () => { window.open(bugReportUrl(appInfo?.version), "_blank", "noopener"); } },
    { key: "idea", label: "Suggest an idea", Icon: Lightbulb, keywords: "feature request feedback github", fn: () => { window.open(ideaUrl(), "_blank", "noopener"); } },
  ];

  const q = query.trim();
  const upper = q.toUpperCase();
  const shownYours = yourTickers.filter((t) => matches(q, t.ticker)).slice(0, q ? 5 : 6);
  const yoursSet = new Set(shownYours.map((t) => t.ticker));
  const shownResults = q ? results.filter((r) => !yoursSet.has(r.symbol)).slice(0, 7) : [];
  const shownPages = PAGES.filter((p) => matches(q, p.label, p.keywords));
  const shownActions = actions.filter((a) => matches(q, a.label, a.keywords));
  // A ticker-looking query can always be opened directly, even before search results arrive
  // Tickers are short (KO, ABBV), have a market suffix (ENB.TO, HDFCBANK.NS) or are indices (^GSPC)
  const tickerShaped = /^[A-Z]{1,5}(-[A-Z])?$/.test(upper) || /^[A-Z0-9\-]{1,12}\.[A-Z]{1,3}$/.test(upper) || /^\^[A-Z0-9]{1,10}$/.test(upper);
  const looksLikeTicker = tickerShaped && !yoursSet.has(upper) && !shownResults.some((r) => r.symbol === upper);
  // When a page or action matches what was typed, offer it before treating the text as a ticker
  const openLast = q.length >= 3 && shownPages.length + shownActions.length > 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ground/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          <DialogPrimitive.Title className="sr-only">Search DividendCase</DialogPrimitive.Title>
          <Command shouldFilter={false} loop className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-ink-3" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search any stock, or jump to a page…"
                className="h-13 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
              />
              {isSearching && <Loader2 className="size-4 shrink-0 animate-spin text-ink-3" />}
              <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-ink-3 sm:block">esc</kbd>
            </div>
            <Command.List className="max-h-[min(60vh,440px)] overflow-y-auto overscroll-contain pb-2">
              <Command.Empty className="px-4 py-10 text-center text-[13px] text-ink-3">
                {isSearching ? "Searching…" : "Nothing found. Try a ticker such as KO, ENB.TO or HDFCBANK.NS"}
              </Command.Empty>

              {/* Pages and actions lead when they match what was typed; otherwise stocks do */}
              {openLast && shownPages.length > 0 && (
                <Command.Group heading="Go to" className={groupClass}>
                  {shownPages.map(({ href, label, hint, Icon }) => (
                    <Command.Item key={href} value={`p-${href}`} onSelect={() => go(href)} className={itemClass}>
                      <Icon className="text-ink-3 group-data-[selected=true]:text-sprout" />
                      <span>{label}</span>
                      {hint && <span className="ml-auto text-[12px] text-ink-3">{hint}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {openLast && shownActions.length > 0 && (
                <Command.Group heading="Actions" className={groupClass}>
                  {shownActions.map(({ key, label, Icon, fn }) => (
                    <Command.Item key={key} value={`a-${key}`} onSelect={() => run(key, fn)} className={itemClass}>
                      {busy === key ? <Loader2 className="animate-spin" /> : <Icon className="text-ink-3 group-data-[selected=true]:text-sprout" />}
                      <span>{label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {shownYours.length > 0 && (
                <Command.Group heading="Your stocks" className={groupClass}>
                  {shownYours.map((t) => (
                    <Command.Item key={`y-${t.ticker}`} value={`y-${t.ticker}`} onSelect={() => openStock(t.ticker)} className={itemClass}>
                      <TickerBadge ticker={t.ticker} />
                      <span className="num font-medium text-ink">{t.ticker}</span>
                      <span className="ml-auto text-[12px] text-ink-3">{t.kind}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {shownResults.length > 0 && (
                <Command.Group heading="Stocks and ETFs" className={groupClass}>
                  {shownResults.map((r) => (
                    <Command.Item key={`s-${r.symbol}`} value={`s-${r.symbol}`} onSelect={() => openStock(r.symbol)} className={itemClass}>
                      <TickerBadge ticker={r.symbol} />
                      <span className="num w-28 shrink-0 truncate font-medium text-ink">{r.symbol}</span>
                      <span className="truncate">{r.name}</span>
                      <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-3">{r.exchange}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {looksLikeTicker && !openLast && (
                <Command.Group heading="Open" className={groupClass}>
                  <Command.Item value={`open-${upper}`} onSelect={() => openStock(upper)} className={itemClass}>
                    <ArrowRight />
                    <span>
                      Open <span className="num font-medium text-ink">{upper}</span>
                    </span>
                  </Command.Item>
                </Command.Group>
              )}

              {!openLast && shownPages.length > 0 && (
                <Command.Group heading="Go to" className={groupClass}>
                  {shownPages.map(({ href, label, hint, Icon }) => (
                    <Command.Item key={href} value={`p-${href}`} onSelect={() => go(href)} className={itemClass}>
                      <Icon className="text-ink-3 group-data-[selected=true]:text-sprout" />
                      <span>{label}</span>
                      {hint && <span className="ml-auto text-[12px] text-ink-3">{hint}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {!openLast && shownActions.length > 0 && (
                <Command.Group heading="Actions" className={groupClass}>
                  {shownActions.map(({ key, label, Icon, fn }) => (
                    <Command.Item key={key} value={`a-${key}`} onSelect={() => run(key, fn)} className={itemClass}>
                      {busy === key ? <Loader2 className="animate-spin" /> : <Icon className="text-ink-3 group-data-[selected=true]:text-sprout" />}
                      <span>{label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {looksLikeTicker && openLast && (
                <Command.Group heading="Open" className={groupClass}>
                  <Command.Item value={`open-${upper}`} onSelect={() => openStock(upper)} className={itemClass}>
                    <ArrowRight />
                    <span>
                      Open <span className="num font-medium text-ink">{upper}</span>
                    </span>
                  </Command.Item>
                </Command.Group>
              )}

            </Command.List>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2 font-mono text-[10.5px] text-ink-3">
              <span><kbd className="text-ink-2">↑↓</kbd> move</span>
              <span><kbd className="text-ink-2">↵</kbd> open</span>
              <span className="ml-auto hidden sm:inline">Search runs on this computer</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

