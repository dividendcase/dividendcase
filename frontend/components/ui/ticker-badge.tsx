import { cn } from "@/lib/utils";

/** The first letters of a ticker in a small tile, used in lists of stocks. */
export function TickerBadge({ ticker, className }: { ticker: string; className?: string }) {
  const short = ticker.replace(/\..*$/, "").replace(/^\^/, "").slice(0, 4);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-well font-mono text-[9.5px] font-semibold tracking-tight text-ink-2",
        className
      )}
    >
      {short}
    </span>
  );
}
