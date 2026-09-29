import useSWR from "swr";
import { API_BASE } from "@/lib/api/backend";

export interface RefreshProgress {
  total: number;
  done: number;
  saved: number;
  skipped: number;
  failed: number;
  started_at: string | null;
}

export interface LastRun {
  finished_at: string | null;
  status: string | null;
  saved: number | null;
  note: string | null;
}

export interface DataStatus {
  state: "idle" | "fetching" | "waiting";
  message: string;
  current: { ticker: string; kind: "holdings" | "screener" } | null;
  queued: number;
  cooldown_seconds: number;
  holdings: RefreshProgress;
  screener: RefreshProgress;
  stocks: number;
  dividend_records: number;
  your_tickers: number;
  your_tickers_missing: number;
  last_runs: { holdings: LastRun; screener: LastRun };
  /** Latest day of European Central Bank rates stored, if any */
  fx_latest_date: string | null;
  fx_days: number;
}

async function fetchStatus(): Promise<DataStatus> {
  const res = await fetch(`${API_BASE}/api/v1/data/status`);
  if (!res.ok) throw new Error(`Data status ${res.status}`);
  return res.json();
}

export function isBusy(status?: DataStatus): boolean {
  return !!status && (status.state !== "idle" || status.queued > 0);
}

export function useDataStatus() {
  const { data, error, mutate } = useSWR<DataStatus>("data-status", fetchStatus, {
    // Poll quickly while a refresh runs, slowly otherwise
    refreshInterval: (latest) => (isBusy(latest) ? 2000 : 15000),
  });

  const startRefresh = async (scope: "holdings" | "screener", force = false) => {
    await fetch(`${API_BASE}/api/v1/data/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, force }),
    });
    mutate();
  };

  return { status: data, error, startRefresh };
}
