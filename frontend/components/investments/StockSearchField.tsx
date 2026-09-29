"use client";

import { useEffect, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TickerBadge } from "@/components/ui/ticker-badge";
import { useStockSearch } from "@/lib/hooks/useStockSearch";
import { cn } from "@/lib/utils";
import type { StockSearchResult } from "@/lib/types";

interface StockSearchFieldProps {
  onSelect: (result: StockSearchResult) => void;
  placeholder?: string;
  /** Text to show in the field once a stock is picked (the caller decides) */
  value?: string;
  onValueChange?: (text: string) => void;
  autoFocus?: boolean;
  id?: string;
  className?: string;
  /** Clear the field after a pick, for "add another" style pickers */
  clearOnSelect?: boolean;
}

/** A search box with a results list: the local ticker list first, then Yahoo Finance. */
export function StockSearchField({
  onSelect,
  placeholder = "Search a ticker or company, such as KO or Enbridge",
  value,
  onValueChange,
  autoFocus,
  id,
  className,
  clearOnSelect = false,
}: StockSearchFieldProps) {
  const { query, setQuery, results, isSearching, submitSearch, clearResults } = useStockSearch();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = `${id ?? "stock-search"}-list`;

  // A controlled caller can reset the text (after adding, for example)
  useEffect(() => {
    if (value !== undefined && value !== query) setQuery(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // The list is drawn outside the field (see below), so clicks in it don't count as outside
      if (containerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => setActive(0), [results]);

  const pick = (r: StockSearchResult) => {
    onSelect(r);
    setOpen(false);
    clearResults();
    const next = clearOnSelect ? "" : r.symbol;
    setQuery(next);
    onValueChange?.(next);
  };

  const showList = open && query.length > 0 && (results.length > 0 || isSearching);

  return (
    <PopoverPrimitive.Root open={showList}>
      <PopoverPrimitive.Anchor asChild>
        <div ref={containerRef} className={cn("relative", className)}>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            id={id}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            autoFocus={autoFocus}
            placeholder={placeholder}
            value={query}
            className="pl-9 pr-9"
            onChange={(e) => {
              setQuery(e.target.value);
              onValueChange?.(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (showList && results[active]) pick(results[active]);
                else if (query.trim()) submitSearch(query.trim());
              } else if (e.key === "Escape" && showList) {
                e.stopPropagation();
                setOpen(false);
              }
            }}
          />
          {isSearching && (
            <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-3" />
          )}
        </div>
      </PopoverPrimitive.Anchor>

      {/* Drawn in a portal, so cards with overflow-hidden and dialogs can't clip it */}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={listRef}
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          style={{ width: "var(--radix-popper-anchor-width)" }}
          className="z-50 outline-none"
        >
          <div
            id={listId}
            role="listbox"
            className="max-h-64 overflow-y-auto rounded-lg border border-line bg-raised p-1 shadow-pop"
          >
            {results.length === 0 && isSearching && (
              <p className="px-3 py-2 text-[12.5px] text-ink-3">Searching Yahoo Finance…</p>
            )}
            {results.map((r, i) => (
              <button
                key={r.symbol}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                // Keep the focus in the text field while picking
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-[13px] text-ink-2 transition-colors",
                  i === active && "bg-overlay text-ink"
                )}
              >
                <TickerBadge ticker={r.symbol} />
                <span className="num w-24 shrink-0 truncate font-medium text-ink">{r.symbol}</span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                {r.exchange && <span className="shrink-0 font-mono text-[10.5px] text-ink-3">{r.exchange}</span>}
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
