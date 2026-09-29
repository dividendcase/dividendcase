"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { ArrowRightLeft, BarChart3, GripVertical, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TickerBadge } from "@/components/ui/ticker-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { stockHref, useStockDetail } from "@/components/investments/stockDetail";
import { frequencyLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WatchlistItem, WatchlistGroup } from "@/lib/types";

interface WatchlistCardProps {
  item: WatchlistItem;
  groups: WatchlistGroup[];
  currentGroupId: number;
  onRemove: (ticker: string) => void;
  onMove: (itemId: number, targetGroupId: number) => void;
}

/** Stops a press on a button inside the card from starting a drag. */
const noDrag = {
  onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
};

/** The card body, shared by the list and the copy that follows the pointer while dragging. */
export function WatchlistCardBody({ ticker, trailing, dragging }: { ticker: string; trailing?: React.ReactNode; dragging?: boolean }) {
  const { detail, isLoading } = useStockDetail(ticker);
  const yieldPct = detail?.avg_dividend_yield;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <TickerBadge ticker={ticker} />
      <div className="min-w-0 flex-1">
        {dragging ? (
          <span className="num block truncate text-[13px] font-medium text-ink">{ticker}</span>
        ) : (
          <Link href={stockHref(ticker)} className="num block truncate text-[13px] font-medium text-ink hover:text-sprout">
            {ticker}
          </Link>
        )}
        <span className="block truncate text-[12px] text-ink-3">
          {detail?.company_name ?? (isLoading ? " " : "Not fetched yet")}
        </span>
      </div>
      <div className="shrink-0 text-right">
        {yieldPct != null && yieldPct > 0 ? (
          <>
            <span className="num block text-[13px] text-ink">{yieldPct.toFixed(2)}%</span>
            <span className="block text-[11px] text-ink-3">
              {detail?.payment_frequency ? frequencyLabel(detail.payment_frequency) : "yield"}
            </span>
          </>
        ) : (
          <span className="num block text-[12px] text-ink-3">—</span>
        )}
      </div>
      {trailing}
    </div>
  );
}

export function WatchlistCard({ item, groups, currentGroupId, onRemove, onMove }: WatchlistCardProps) {
  const otherGroups = groups.filter((g) => g.id !== currentGroupId);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `item-${item.id}`,
    data: { item, groupId: currentGroupId },
  });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable stock"
      aria-label={item.ticker_symbol}
      className={cn(
        "group relative cursor-grab select-none rounded-lg border border-line bg-well px-2.5 py-2 outline-none transition-colors hover:border-line-strong focus-visible:border-sprout/60 focus-visible:ring-2 focus-visible:ring-sprout/20 active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <WatchlistCardBody
        ticker={item.ticker_symbol}
        trailing={
          <div className="flex shrink-0 items-center" {...noDrag}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 text-ink-3" aria-label={`Actions for ${item.ticker_symbol}`}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem asChild>
                  <Link href={stockHref(item.ticker_symbol)}>
                    <BarChart3 /> Open analysis
                  </Link>
                </DropdownMenuItem>
                {otherGroups.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="flex items-center gap-1.5">
                      <ArrowRightLeft className="size-3" /> Move to
                    </DropdownMenuLabel>
                    {otherGroups.map((g) => (
                      <DropdownMenuItem key={g.id} onSelect={() => onMove(item.id, g.id)}>
                        {g.name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onRemove(item.ticker_symbol)} className="text-cut focus:bg-cut/10 focus:text-cut">
                  <Trash2 /> Remove from watchlist
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <GripVertical aria-hidden="true" className="size-3.5 text-ink-3/50 transition-colors group-hover:text-ink-3" />
          </div>
        }
      />
    </div>
  );
}
