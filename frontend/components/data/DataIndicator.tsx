"use client";

import Link from "next/link";
import { PauseCircle } from "lucide-react";
import { isBusy, useDataStatus } from "@/lib/hooks/useDataStatus";

/** Small header pill while a background refresh runs; links to the Data page. */
export function DataIndicator() {
  const { status } = useDataStatus();
  if (!status || !isBusy(status)) return null;

  const total = status.holdings.total + status.screener.total;
  const done = status.holdings.done + status.screener.done;
  const waiting = status.state === "waiting";
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Link
      href="/dashboard/data/"
      className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface py-1 pl-2 pr-3 text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
      title={status.message || "Fetching market data in the background"}
    >
      {waiting ? (
        <PauseCircle className="size-3.5 text-watch" aria-hidden="true" />
      ) : (
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-sprout/60" />
          <span className="relative inline-flex size-2 rounded-full bg-sprout" />
        </span>
      )}
      <span className="hidden sm:inline">{waiting ? "Paused by Yahoo" : "Updating data"}</span>
      <span className="num text-ink-3">{total > 0 ? `${pct}%` : `${done}/${total}`}</span>
    </Link>
  );
}
