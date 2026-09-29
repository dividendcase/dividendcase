"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockInfo } from "@/lib/hooks/useStockInfo";
import { formatShortDate } from "@/lib/format";
import type { DividendHistoryResponse } from "@/lib/types";

export const EXCHANGE_NAMES: Record<string, string> = {
  NYSE: "New York Stock Exchange",
  NASDAQ: "Nasdaq",
  NSE: "National Stock Exchange of India",
  BSE: "Bombay Stock Exchange",
  TSX: "Toronto Stock Exchange",
  LSE: "London Stock Exchange",
  ISE: "Euronext Dublin",
  ASX: "Australian Securities Exchange",
  NMS: "Nasdaq Global Select",
  NGM: "Nasdaq Global Market",
  NCM: "Nasdaq Capital Market",
  NYQ: "New York Stock Exchange",
  PCX: "NYSE Arca",
  TOR: "Toronto Stock Exchange",
  BOM: "Bombay Stock Exchange",
};

interface Props {
  data: DividendHistoryResponse | undefined;
  isLoading: boolean;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  );
}

export function CompanyInfoCard({ data, isLoading }: Props) {
  const { info, isLoading: infoLoading } = useStockInfo(data?.ticker_symbol ?? null);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-xl lg:col-span-2" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }
  if (!data) return null;

  const summary = info?.summary ?? null;
  const long = (summary?.length ?? 0) > 420;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Card className="p-4 sm:p-5 lg:col-span-2">
        <p className="eyebrow mb-2">About</p>
        {infoLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : summary ? (
          <>
            <p className={`text-[13.5px] leading-relaxed text-ink-2 ${!expanded && long ? "line-clamp-4" : ""}`}>{summary}</p>
            {long && (
              <button onClick={() => setExpanded((v) => !v)} className="mt-1.5 text-[12.5px] font-medium text-ink hover:text-sprout">
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </>
        ) : (
          <p className="text-[13.5px] text-ink-3">No company description yet. It is fetched with the next refresh.</p>
        )}
        <a
          href={`https://finance.yahoo.com/quote/${encodeURIComponent(data.ticker_symbol)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-ink"
        >
          <ExternalLink className="size-3.5" />
          Yahoo Finance
        </a>
      </Card>

      <Card className="p-4 sm:p-5">
        <p className="eyebrow mb-3">Details</p>
        <dl className="text-[13px]">
          <Row label="Exchange">
            <span title={EXCHANGE_NAMES[data.exchange] ?? data.exchange}>{EXCHANGE_NAMES[data.exchange] ?? data.exchange}</span>
          </Row>
          <Row label="Currency"><span className="num">{data.currency}</span></Row>
          {info?.sector && <Row label="Sector">{info.sector}</Row>}
          {info?.industry && <Row label="Industry"><span className="line-clamp-2">{info.industry}</span></Row>}
          {data.metrics.last_dividend_date && (
            <Row label="Last dividend"><span className="num">{formatShortDate(data.metrics.last_dividend_date)}</span></Row>
          )}
        </dl>
      </Card>
    </div>
  );
}
