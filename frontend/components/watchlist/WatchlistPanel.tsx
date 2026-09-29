"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";
import { Check, ChevronDown, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StockSearchField } from "@/components/investments/StockSearchField";
import { cn } from "@/lib/utils";
import type { WatchlistItem, WatchlistGroup } from "@/lib/types";
import { WatchlistCard } from "./WatchlistCard";

interface WatchlistPanelProps {
  group: WatchlistGroup;
  groups: WatchlistGroup[];
  items: WatchlistItem[];
  canDelete: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (groupId: number, name: string) => void;
  onDelete: (groupId: number) => void;
  onRemoveItem: (ticker: string, groupId: number) => void;
  onMoveItem: (itemId: number, targetGroupId: number) => void;
  onAddItem: (ticker: string, groupId: number) => Promise<void>;
}

/** One watchlist as a column on the board; stocks can be dropped onto it. */
export function WatchlistPanel({
  group,
  groups,
  items,
  canDelete,
  isExpanded,
  onToggle,
  onRename,
  onDelete,
  onRemoveItem,
  onMoveItem,
  onAddItem,
}: WatchlistPanelProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // The menu returns focus to its button when it closes; skip that when it opened a field
  const keepFocus = useRef(false);
  const { setNodeRef, isOver, active } = useDroppable({ id: `group-${group.id}`, data: { groupId: group.id } });
  const draggingFromElsewhere = active != null && active.data.current?.groupId !== group.id;

  useEffect(() => {
    if (isRenaming) inputRef.current?.select();
  }, [isRenaming]);

  const handleRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== group.name) onRename(group.id, trimmed);
    setIsRenaming(false);
  };

  const addStock = async (ticker: string) => {
    if (items.some((i) => i.ticker_symbol === ticker)) {
      setAddError(`${ticker} is already in ${group.name}.`);
      return;
    }
    setAddError("");
    try {
      await onAddItem(ticker, group.id);
      setIsAdding(false);
    } catch {
      setAddError(`Couldn't add ${ticker}.`);
    }
  };

  return (
    <section
      ref={setNodeRef}
      aria-label={group.name}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-surface shadow-card transition-colors",
        isOver && draggingFromElsewhere ? "border-sprout/60 bg-sprout/5" : draggingFromElsewhere ? "border-line-strong border-dashed" : "border-line"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 border-b border-line py-2.5 pl-3 pr-2">
        {isRenaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <Input
              ref={inputRef}
              aria-label="Watchlist name"
              maxLength={40}
              className="h-8 text-[14px] font-semibold"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setIsRenaming(false);
              }}
            />
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Save name" onClick={handleRename}>
              <Check className="size-4 text-sprout" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Cancel renaming" onClick={() => setIsRenaming(false)}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <>
            <button
              onClick={onToggle}
              aria-expanded={isExpanded}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left"
            >
              <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform", !isExpanded && "-rotate-90")} />
              <h2 className="truncate text-[14px] font-semibold text-ink">{group.name}</h2>
              <span className="num shrink-0 rounded-full bg-raised px-1.5 py-px text-[11px] text-ink-2">{items.length}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 shrink-0 text-ink-3" aria-label={`Actions for ${group.name}`}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(e) => {
                  if (keepFocus.current) {
                    e.preventDefault();
                    keepFocus.current = false;
                  }
                }}
              >
                <DropdownMenuItem
                  onSelect={() => {
                    keepFocus.current = true;
                    if (!isExpanded) onToggle();
                    setIsAdding(true);
                  }}
                >
                  <Plus /> Add a stock
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    keepFocus.current = true;
                    setRenameValue(group.name);
                    setIsRenaming(true);
                  }}
                >
                  <Pencil /> Rename
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onDelete(group.id)} className="text-cut focus:bg-cut/10 focus:text-cut">
                      <Trash2 /> Delete watchlist
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Stocks */}
      {isExpanded ? (
        <div className="flex flex-1 flex-col gap-2 p-2.5">
          {items.length === 0 && !isAdding && (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line px-4 py-8 text-center">
              <p className="text-[13px] font-medium text-ink-2">No stocks yet</p>
              <p className="max-w-[16rem] text-[12px] leading-relaxed text-ink-3">
                Drag one here, add one below, or save stocks from the{" "}
                <Link href="/dashboard/screener/" className="text-sprout underline-offset-4 hover:underline">
                  screener
                </Link>
                .
              </p>
            </div>
          )}
          {items.map((item) => (
            <WatchlistCard
              key={item.id}
              item={item}
              groups={groups}
              currentGroupId={group.id}
              onRemove={(ticker) => onRemoveItem(ticker, group.id)}
              onMove={onMoveItem}
            />
          ))}

          {isAdding ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1">
                <StockSearchField
                  id={`watchlist-add-${group.id}`}
                  autoFocus
                  clearOnSelect
                  className="flex-1"
                  placeholder="Ticker or company"
                  onSelect={(r) => addStock(r.symbol)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Stop adding"
                  onClick={() => {
                    setIsAdding(false);
                    setAddError("");
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
              {addError && <p className="px-1 text-[12px] text-cut">{addError}</p>}
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="mt-auto flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-ink-3 transition-colors hover:bg-raised hover:text-ink"
            >
              <Plus className="size-3.5" /> Add a stock
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="px-3 py-3 text-left text-[12.5px] text-ink-3 transition-colors hover:text-ink"
        >
          {items.length === 0 ? "Empty. Drop a stock here." : `Show ${items.length} stock${items.length === 1 ? "" : "s"}`}
        </button>
      )}
    </section>
  );
}
