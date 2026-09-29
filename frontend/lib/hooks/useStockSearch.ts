"use client";
import { useState, useEffect, useCallback } from "react";
import type { StockSearchResult } from "@/lib/types";
import { API_BASE } from "@/lib/api/backend";

// ── Static ticker cache (loaded once from /tickers.json) ────────────────────
let tickerCache: Array<{ s: string; n: string; e: string }> | null = null;
let tickerLoadPromise: Promise<typeof tickerCache> | null = null;

async function loadTickers() {
  if (tickerCache) return tickerCache;
  if (tickerLoadPromise) return tickerLoadPromise;
  tickerLoadPromise = fetch("/tickers.json")
    .then((r) => r.json())
    .then((data) => { tickerCache = data; return data; })
    .catch(() => { tickerLoadPromise = null; return []; });
  return tickerLoadPromise;
}

function searchStatic(
  tickers: Array<{ s: string; n: string; e: string }>,
  q: string
): StockSearchResult[] {
  const upper = q.toUpperCase();
  const lower = q.toLowerCase();
  const prefix = tickers.filter((t) => t.s.startsWith(upper));
  const name   = tickers.filter((t) => !t.s.startsWith(upper) && t.n.toLowerCase().includes(lower));
  return [...prefix, ...name].slice(0, 8).map((t) => ({
    symbol: t.s, name: t.n, exchange: t.e, type: "Equity",
  }));
}

// ── Wider search: stocks already in the local database, then Yahoo Finance ──
async function searchYahooFinance(q: string): Promise<StockSearchResult[]> {
  const query = encodeURIComponent(q);
  try {
    const dbRes = await fetch(`${API_BASE}/api/v1/stocks/search?q=${query}&limit=10`);
    if (dbRes.ok) {
      const stocks = (await dbRes.json()) as Array<{ ticker_symbol: string; company_name: string; exchange: string }>;
      if (stocks.length > 0) {
        return stocks.map((s) => ({ symbol: s.ticker_symbol, name: s.company_name, exchange: s.exchange, type: "Equity" }));
      }
    }
    const yfRes = await fetch(`${API_BASE}/api/v1/search/symbols?q=${query}&limit=10`);
    if (yfRes.ok) {
      const results = await yfRes.json();
      if (Array.isArray(results)) return results as StockSearchResult[];
    }
  } catch {
    // Local API unreachable
  }
  return [];
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useStockSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Pre-warm the cache so first keystroke is instant
  useEffect(() => { loadTickers(); }, []);

  // Instant as-you-type results from the static list, then auto-search Yahoo Finance
  // if there are no local matches (catches stocks like CESC.NS not in our curated list).
  useEffect(() => {
    if (!query) { setResults([]); return; }
    let cancelled = false;
    let autoTimer: ReturnType<typeof setTimeout> | null = null;

    loadTickers().then((tickers) => {
      if (cancelled) return;
      const local = tickers ? searchStatic(tickers, query) : [];
      setResults(local);
      // Auto-trigger Yahoo Finance after 400 ms when local list has no matches
      if (local.length === 0 && query.length >= 2) {
        autoTimer = setTimeout(() => {
          if (!cancelled) submitSearch(query);
        }, 400);
      }
    });

    return () => {
      cancelled = true;
      if (autoTimer) clearTimeout(autoTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Called on Enter key or Search button — hits Yahoo Finance for authoritative results
  const submitSearch = useCallback(async (q: string) => {
    if (!q) return;
    setIsSearching(true);
    try {
      const [staticResults, yfResults] = await Promise.all([
        loadTickers().then((t) => (t ? searchStatic(t, q) : [])),
        searchYahooFinance(q),
      ]);

      // Yahoo Finance results are authoritative; fill remaining slots from static list
      const yfSymbols = new Set(yfResults.map((r) => r.symbol));
      const extra = staticResults.filter((r) => !yfSymbols.has(r.symbol));
      setResults([...yfResults, ...extra].slice(0, 10));
    } catch {
      // Keep whatever static results we already have
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setIsSearching(false);
  }, []);

  return { query, setQuery, results, isSearching, submitSearch, clearResults };
}
