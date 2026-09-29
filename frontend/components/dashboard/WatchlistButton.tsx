"use client";

import { useState, useRef, useEffect } from "react";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import { useWatchlistGroups } from "@/lib/hooks/useWatchlistGroups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bookmark, BookmarkCheck, Check, X, Plus, ArrowRight } from "lucide-react";

const MAX_GROUPS = 4;

interface Props { ticker: string }

export function WatchlistButton({ ticker }: Props) {
  const { items, add, remove, move, isLoading } = useWatchlist();
  const { groups, create } = useWatchlistGroups();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const savedItem = items.find((i) => i.ticker_symbol === ticker);
  const savedGroupId = savedItem?.watchlist_group_id ?? null;
  const savedGroup = groups.find((g) => g.id === savedGroupId);
  const atGroupLimit = groups.length >= MAX_GROUPS;
  const isSaved = !!savedItem;

  if (isLoading) return null;

  const handleClose = () => {
    setOpen(false);
    setCreating(false);
    setNewName("");
  };

  const handleAddToGroup = async (groupId: number) => {
    await add(ticker, groupId);
    handleClose();
  };

  const handleMoveToGroup = async (groupId: number) => {
    if (!savedItem) return;
    await move(savedItem.id, groupId);
    handleClose();
  };

  const handleRemove = async () => {
    await remove(ticker);
    handleClose();
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const newGroup = await create(trimmed);
    setNewName("");
    setCreating(false);
    await add(ticker, newGroup.id);
    handleClose();
  };

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(true); }}>
      <PopoverTrigger asChild>
        <Button variant={isSaved ? "secondary" : "outline"} size="sm">
          {isSaved ? (
            <>
              <BookmarkCheck className="w-4 h-4 text-sprout" />
              Saved{savedGroup ? ` · ${savedGroup.name}` : ""}
            </>
          ) : (
            <>
              <Bookmark className="w-4 h-4" />
              Save to watchlist
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="eyebrow px-2 pb-1.5">
          {isSaved ? "Move to watchlist" : "Save to watchlist"}
        </p>

        <div className="space-y-0.5">
          {groups.map((group) => {
            const isCurrent = group.id === savedGroupId;
            return (
              <button
                key={group.id}
                onClick={() => {
                  if (isCurrent) return;
                  isSaved ? handleMoveToGroup(group.id) : handleAddToGroup(group.id);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  isCurrent
                    ? "text-foreground cursor-default"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {isCurrent ? (
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : isSaved ? (
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <span className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">{group.name}</span>
                {!isCurrent && isSaved && (
                  <span className="ml-auto text-[10px] text-muted-foreground/60 shrink-0">Move</span>
                )}
              </button>
            );
          })}
        </div>

        {!atGroupLimit && (
          <div className="border-t border-border mt-1.5 pt-1.5">
            {creating ? (
              <div className="flex items-center gap-1 px-1">
                <Input
                  ref={inputRef}
                  className="h-7 text-xs flex-1"
                  placeholder="Watchlist name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") { setCreating(false); setNewName(""); }
                  }}
                />
                <button onClick={handleCreate} className="p-1 hover:bg-muted rounded">
                  <Check className="w-3.5 h-3.5 text-money" />
                </button>
                <button onClick={() => { setCreating(false); setNewName(""); }} className="p-1 hover:bg-muted rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                Create new watchlist
              </button>
            )}
          </div>
        )}

        {isSaved && (
          <div className="border-t border-border mt-1.5 pt-1.5">
            <button
              onClick={handleRemove}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <X className="w-3.5 h-3.5 shrink-0" />
              Remove from watchlist
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
