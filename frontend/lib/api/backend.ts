import type { StockSummary, DividendHistoryResponse } from "@/lib/types";

// Same origin when served by the local app; `npm run dev` points it at the API (see .env.development)
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { headers: initHeaders, ...restInit } = init ?? {};
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...initHeaders },
    ...restInit,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getTopPerformers(params?: {
  exchanges?: string[];
  minYield?: number;
  beatsBenchmark?: boolean;
  limit?: number;
}): Promise<StockSummary[]> {
  const q = new URLSearchParams();
  if (params?.exchanges?.length) {
    for (const ex of params.exchanges) q.append("exchange", ex);
  }
  if (params?.minYield != null) q.set("minYield", String(params.minYield));
  if (params?.beatsBenchmark != null) q.set("beatsBenchmark", String(params.beatsBenchmark));
  if (params?.limit != null) q.set("limit", String(params.limit));
  return apiFetch<StockSummary[]>(`/api/v1/stocks/top-performers?${q}`);
}

export async function getDividendHistory(
  ticker: string,
  years: number = 10
): Promise<DividendHistoryResponse> {
  return apiFetch<DividendHistoryResponse>(
    `/api/v1/dividends/${encodeURIComponent(ticker)}?years=${years}`
  );
}

export async function fetchCustomStock(ticker: string): Promise<DividendHistoryResponse> {
  return apiFetch<DividendHistoryResponse>("/api/v1/search/fetch-stock", {
    method: "POST",
    body: JSON.stringify({ ticker }),
  });
}

// ── Watchlist Groups ─────────────────────────────────────────────────────────

import type { WatchlistGroup } from "@/lib/types";

export async function getWatchlistGroups(): Promise<WatchlistGroup[]> {
  return apiFetch<WatchlistGroup[]>("/api/v1/watchlist/groups", {
  });
}

export async function createWatchlistGroup(name: string): Promise<WatchlistGroup> {
  return apiFetch<WatchlistGroup>("/api/v1/watchlist/groups", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function renameWatchlistGroup(groupId: number, name: string): Promise<WatchlistGroup> {
  return apiFetch<WatchlistGroup>(`/api/v1/watchlist/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function deleteWatchlistGroup(groupId: number): Promise<void> {
  await fetch(`${API_BASE}/api/v1/watchlist/groups/${groupId}`, {
    method: "DELETE",
  });
}

// ── Watchlist Items ─────────────────────────────────────────────────────────

export async function getWatchlist(groupId?: number) {
  const q = groupId != null ? `?group_id=${groupId}` : "";
  return apiFetch<{ id: number; ticker_symbol: string; watchlist_group_id?: number; added_at: string }[]>(
    `/api/v1/watchlist${q}`
  );
}

export async function addToWatchlist(ticker: string, groupId?: number) {
  return apiFetch("/api/v1/watchlist", {
    method: "POST",
    body: JSON.stringify({ ticker, group_id: groupId ?? null }),
  });
}

export async function removeFromWatchlist(ticker: string, groupId?: number) {
  const q = groupId != null ? `?group_id=${groupId}` : "";
  await fetch(`${API_BASE}/api/v1/watchlist/${encodeURIComponent(ticker)}${q}`, {
    method: "DELETE",
  });
}

export async function moveWatchlistItem(itemId: number, targetGroupId: number) {
  return apiFetch<{ id: number; ticker_symbol: string; watchlist_group_id: number; added_at: string }>(
    `/api/v1/watchlist/${itemId}/move`,
    {
      method: "PATCH",
      body: JSON.stringify({ target_group_id: targetGroupId }),
    }
  );
}

// ── Portfolio Groups ─────────────────────────────────────────────────────────

import type { Portfolio, InvestmentItem, PortfolioAnalysisResponse, PortfolioCost, FxRates, ScreenerMarket } from "@/lib/types";

export async function getPortfolios(): Promise<Portfolio[]> {
  return apiFetch<Portfolio[]>("/api/v1/portfolios", {
  });
}

export async function createPortfolio(name: string): Promise<Portfolio> {
  return apiFetch<Portfolio>("/api/v1/portfolios", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function renamePortfolio(portfolioId: number, name: string): Promise<Portfolio> {
  return apiFetch<Portfolio>(`/api/v1/portfolios/${portfolioId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function deletePortfolio(portfolioId: number): Promise<void> {
  await fetch(`${API_BASE}/api/v1/portfolios/${portfolioId}`, {
    method: "DELETE",
  });
}

// ── Portfolio / Investments ───────────────────────────────────────────────────

export async function getInvestments(portfolioId?: number): Promise<InvestmentItem[]> {
  const q = portfolioId != null ? `?portfolio_id=${portfolioId}` : "";
  return apiFetch<InvestmentItem[]>(`/api/v1/portfolio${q}`, {
  });
}

export async function addInvestment(
  data: { ticker: string; purchase_date: string; quantity: number; purchase_price?: number; purchase_currency?: string; portfolio_id?: number },
): Promise<InvestmentItem> {
  return apiFetch<InvestmentItem>("/api/v1/portfolio", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function removeInvestment(id: number): Promise<void> {
  await fetch(`${API_BASE}/api/v1/portfolio/${id}`, {
    method: "DELETE",
  });
}

export async function moveInvestment(id: number, targetPortfolioId: number): Promise<InvestmentItem> {
  return apiFetch<InvestmentItem>(`/api/v1/portfolio/${id}/move`, {
    method: "PATCH",
    body: JSON.stringify({ target_portfolio_id: targetPortfolioId }),
  });
}

export async function updateInvestment(
  id: number,
  data: { quantity?: number; purchase_price?: number; purchase_date?: string; purchase_currency?: string },
): Promise<InvestmentItem> {
  return apiFetch<InvestmentItem>(`/api/v1/portfolio/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getPortfolioAnalysis(portfolioId?: number, currency?: string): Promise<PortfolioAnalysisResponse> {
  const q = new URLSearchParams();
  if (portfolioId != null) q.set("portfolio_id", String(portfolioId));
  if (currency) q.set("currency", currency);
  const qs = q.toString();
  return apiFetch<PortfolioAnalysisResponse>(`/api/v1/portfolio/analysis${qs ? `?${qs}` : ""}`);
}

export async function getPortfolioCost(currency: string, portfolioId?: number): Promise<PortfolioCost> {
  const q = new URLSearchParams({ currency });
  if (portfolioId != null) q.set("portfolio_id", String(portfolioId));
  return apiFetch<PortfolioCost>(`/api/v1/portfolio/cost?${q}`);
}

export async function getFxRates(): Promise<FxRates> {
  return apiFetch<FxRates>("/api/v1/fx/rates");
}

export async function getScreenerMarkets(): Promise<ScreenerMarket[]> {
  return (await apiFetch<{ markets: ScreenerMarket[] }>("/api/v1/data/markets")).markets;
}

// ── Income Calendar ──────────────────────────────────────────────────────────

import type { IncomeCalendarResponse, ImportSummary } from "@/lib/types";

export async function getIncomeCalendar(portfolioId?: number): Promise<IncomeCalendarResponse> {
  const q = portfolioId != null ? `?portfolio_id=${portfolioId}` : "";
  return apiFetch<IncomeCalendarResponse>(`/api/v1/portfolio/calendar${q}`, {
  });
}

// ── Excel Import/Export ─────────────────────────────────────────────────────

async function downloadBlob(path: string, filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadTemplate(): Promise<void> {
  return downloadBlob("/api/v1/excel/template", "dividendcase_template.xlsx");
}

export async function exportPortfolios(): Promise<void> {
  return downloadBlob("/api/v1/excel/export", "dividendcase_export.xlsx");
}

export async function downloadReport(portfolioId?: number): Promise<void> {
  const q = portfolioId != null ? `?portfolio_id=${portfolioId}` : "";
  return downloadBlob(`/api/v1/excel/report${q}`, "dividendcase_report.xlsx");
}

export async function importPortfolios(file: File): Promise<ImportSummary> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/v1/excel/import`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Import failed" }));
    throw new Error(body.detail || `API ${res.status}`);
  }
  return res.json() as Promise<ImportSummary>;
}

// ── Broker imports ──────────────────────────────────────────────────────────

import type { BrokerImportResult, BrokerPreview, HoldingsFilePreview, LotToAdd } from "@/lib/types";

/** An import the API refused; `code` says why when the page should react (e.g. "password_required") */
export class ImportRefused extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

async function importRequest<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "The import failed" }));
    const detail = body.detail;
    if (typeof detail === "string") throw new ImportRefused(detail);
    if (detail && typeof detail === "object" && "message" in detail) throw new ImportRefused(detail.message, detail.code);
    throw new ImportRefused(`The import failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function postFiles<T>(path: string, files: File[], extra: Record<string, string> = {}): Promise<T> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  Object.entries(extra).forEach(([k, v]) => form.append(k, v));
  return importRequest<T>(path, { body: form });
}

/** What Zerodha tradebooks add up to, without changing anything */
export function previewZerodha(files: File[]): Promise<BrokerPreview> {
  return postFiles<BrokerPreview>("/api/v1/imports/zerodha/preview", files);
}

/** Add the lots from Zerodha tradebooks that aren't in the app yet */
export function importZerodha(files: File[], portfolioId?: number): Promise<BrokerImportResult> {
  return postFiles<BrokerImportResult>(
    "/api/v1/imports/zerodha",
    files,
    portfolioId != null ? { portfolio_id: String(portfolioId) } : {},
  );
}

// ── User Preferences ──────────────────────────────────────────────────────────

import type { UserPreferences, UserPreferencesUpdate } from "@/lib/types";

export async function getUserPreferences(): Promise<UserPreferences> {
  return apiFetch<UserPreferences>("/api/v1/user/preferences", {
  });
}

export async function updateUserPreference(
  updates: UserPreferencesUpdate,
): Promise<UserPreferences> {
  return apiFetch<UserPreferences>("/api/v1/user/preferences", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteAccount(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/user/account`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }
}

/** What Revolut account statements add up to, without changing anything */
export function previewRevolut(files: File[]): Promise<BrokerPreview> {
  return postFiles<BrokerPreview>("/api/v1/imports/revolut/preview", files);
}

/** Add the lots from Revolut account statements that aren't in the app yet */
export function importRevolut(files: File[], portfolioId?: number): Promise<BrokerImportResult> {
  return postFiles<BrokerImportResult>(
    "/api/v1/imports/revolut",
    files,
    portfolioId != null ? { portfolio_id: String(portfolioId) } : {},
  );
}

/** Read an Angel One holdings file (and its password, if it has one) without changing anything */
export function previewAngelOne(file: File, password?: string): Promise<HoldingsFilePreview> {
  const form = new FormData();
  form.append("file", file);
  if (password) form.append("password", password);
  return importRequest<HoldingsFilePreview>("/api/v1/imports/angelone/preview", { body: form });
}

/** Add lots the user confirmed; any stock already in the app on that date is skipped */
export function importLots(lots: LotToAdd[], portfolioId?: number): Promise<BrokerImportResult> {
  return importRequest<BrokerImportResult>("/api/v1/imports/lots", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lots, portfolio_id: portfolioId ?? null }),
  });
}

