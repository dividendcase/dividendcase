"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PauseCircle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { formatShortDate } from "@/lib/format";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isBusy, useDataStatus, type LastRun, type RefreshProgress } from "@/lib/hooks/useDataStatus";

function Progress({ label, progress, last }: { label: string; progress: RefreshProgress; last: LastRun }) {
  const running = progress.total > 0;
  const pct = running ? Math.round((progress.done / progress.total) * 100) : last.finished_at ? 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13.5px] font-medium text-ink">{label}</p>
        <p className="num text-[12px] text-ink-3">
          {running ? (
            <>
              <span className="text-ink-2">{progress.done}</span> of {progress.total}
            </>
          ) : (
            `Updated ${timeAgo(last.finished_at)}`
          )}
        </p>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-raised"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out-soft", running ? "bg-sprout" : "bg-sprout/35")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {running ? (
        <p className="text-[12px] text-ink-3">
          <span className="num">{progress.saved}</span> stored · <span className="num">{progress.skipped}</span> without dividends
          {progress.failed > 0 && (
            <span className="text-watch">
              {" "}
              · <span className="num">{progress.failed}</span> failed
            </span>
          )}
        </p>
      ) : (
        last.note && (
          <p className="flex items-start gap-1.5 text-[12px] text-watch">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            {last.note}
          </p>
        )
      )}
    </div>
  );
}

function RefreshRow({
  title,
  description,
  action,
  busy,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="space-y-0.5">
        <p className="text-[13.5px] font-medium text-ink">{title}</p>
        <p className="text-[12.5px] leading-relaxed text-ink-3">{description}</p>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" onClick={onClick} disabled={disabled}>
        <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
        {action}
      </Button>
    </div>
  );
}

export function DataView() {
  const { status, error, startRefresh } = useDataStatus();
  const [starting, setStarting] = useState<"holdings" | "screener" | null>(null);

  const start = async (scope: "holdings" | "screener") => {
    setStarting(scope);
    try {
      await startRefresh(scope, scope === "holdings");
    } finally {
      setStarting(null);
    }
  };

  const busy = isBusy(status);
  const waiting = status?.state === "waiting";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data"
        description="Market data comes from Yahoo Finance and is fetched by this computer, for your own use. Nothing is sent to DividendCase."
      />

      {error && (
        <p role="alert" className="flex items-start gap-2.5 rounded-xl border border-cut/30 bg-cut/10 px-4 py-3 text-[13px] text-cut">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Couldn&apos;t reach the local DividendCase server. Check that the app is still running.
        </p>
      )}

      {status ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Status"
            value={
              <span className={cn("font-sans text-[21px] font-semibold tracking-[-0.02em] sm:text-[23px]", waiting && "text-watch")}>
                {waiting ? "Paused" : busy ? "Updating" : "Up to date"}
              </span>
            }
            icon={
              waiting ? (
                <PauseCircle className="text-watch" />
              ) : busy ? (
                <Loader2 className="animate-spin text-sprout" />
              ) : (
                <CheckCircle2 className="text-sprout" />
              )
            }
            sub={status.current ? <span className="num">{status.current.ticker}</span> : waiting ? "Yahoo asked for a pause" : "Nothing waiting"}
          />
          <Stat label="Stocks stored" value={status.stocks.toLocaleString()} sub="Screener and your own" />
          <Stat label="Dividend payments" value={status.dividend_records.toLocaleString()} sub="On record" />
          <Stat
            label="Your stocks"
            value={status.your_tickers}
            tone={status.your_tickers_missing > 0 ? "watch" : "default"}
            sub={
              status.your_tickers_missing > 0 ? (
                <span className="text-watch">
                  <span className="num">{status.your_tickers_missing}</span> still to fetch
                </span>
              ) : (
                "Holdings and watchlists"
              )
            }
          />
        </div>
      ) : (
        !error && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl" />
            ))}
          </div>
        )
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Background updates</CardTitle>
            <CardDescription>
              {status?.message || (busy ? "Fetching about one stock a second." : "Everything is current.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {status ? (
              <>
                <Progress label="Your holdings and watchlists" progress={status.holdings} last={status.last_runs.holdings} />
                <Progress label="Screener stocks" progress={status.screener} last={status.last_runs.screener} />
                <div className="flex items-baseline justify-between gap-3 border-t border-line pt-4">
                  <div>
                    <p className="text-[13.5px] font-medium text-ink">Exchange rates</p>
                    <p className="text-[12px] text-ink-3">European Central Bank reference rates, checked every few hours</p>
                  </div>
                  <p className="num shrink-0 text-[12px] text-ink-2">
                    {status.fx_latest_date ? `Rates of ${formatShortDate(status.fx_latest_date)}` : "Not downloaded yet"}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update now</CardTitle>
            <CardDescription>
              While the app is open, your stocks update when it starts and every day, and screener stocks every week. If
              Yahoo Finance asks for a pause, the app waits and carries on.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-line">
            <RefreshRow
              title="Refresh your stocks"
              description="Fetch every holding and watchlist stock again, including company details."
              action="Refresh"
              busy={starting === "holdings"}
              disabled={starting !== null}
              onClick={() => start("holdings")}
            />
            <RefreshRow
              title="Update screener data"
              description="Index members not updated in the last week. This can take 15–30 minutes."
              action="Update"
              busy={starting === "screener"}
              disabled={starting !== null}
              onClick={() => start("screener")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
