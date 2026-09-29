"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSWRConfig } from "swr";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Bookmark, Check, Plus, X } from "lucide-react";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import { useWatchlistGroups } from "@/lib/hooks/useWatchlistGroups";
import { useUserPreferences } from "@/lib/hooks/useUserPreferences";
import { addToWatchlist, removeFromWatchlist } from "@/lib/api/backend";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { WatchlistItem } from "@/lib/types";
import { WatchlistPanel } from "./WatchlistPanel";
import { WatchlistCardBody } from "./WatchlistCard";

const MAX_GROUPS = 4;

const COLUMN_CLASSES: Record<number, string> = {
  1: "md:grid-cols-2",
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 xl:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
};

// Pointer inside a column wins; fall back to overlap for keyboard dragging
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

const isWatchlistKey = (key: unknown) =>
  key === "watchlist" || key === "watchlist-groups" || (Array.isArray(key) && key[0] === "watchlist");

export function WatchlistBoard() {
  const { mutate } = useSWRConfig();
  const { groups, isLoading: groupsLoading, create, rename, remove: removeGroup } = useWatchlistGroups();
  const { items: allItems, isLoading: itemsLoading, move, mutate: mutateItems } = useWatchlist();
  const { preferences, isLoading: prefsLoading } = useUserPreferences();
  const refreshAll = () => mutate(isWatchlistKey);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const createInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<WatchlistItem | null>(null);

  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const initializedRef = useRef(false);

  // Apply the "start collapsed" preference once, when the groups first load
  useEffect(() => {
    if (initializedRef.current || groups.length === 0 || prefsLoading) return;
    initializedRef.current = true;
    if (!preferences.watchlist_collapsed) setExpandedGroups(new Set(groups.map((g) => g.id)));
  }, [groups, preferences.watchlist_collapsed, prefsLoading]);

  useEffect(() => {
    if (isCreating) createInputRef.current?.focus();
  }, [isCreating]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const toggleGroup = (id: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const itemsByGroup = useMemo(() => {
    const map = new Map<number, WatchlistItem[]>();
    for (const group of groups) map.set(group.id, []);
    for (const item of allItems) {
      const groupId = item.watchlist_group_id;
      if (groupId != null && map.has(groupId)) map.get(groupId)!.push(item);
    }
    return map;
  }, [allItems, groups]);

  const groupName = (id: number) => groups.find((g) => g.id === id)?.name ?? "that watchlist";

  const handleMoveItem = async (itemId: number, targetGroupId: number) => {
    const item = allItems.find((i) => i.id === itemId);
    if (!item || item.watchlist_group_id === targetGroupId) return;
    if (itemsByGroup.get(targetGroupId)?.some((i) => i.ticker_symbol === item.ticker_symbol)) {
      setNotice(`${item.ticker_symbol} is already in ${groupName(targetGroupId)}.`);
      return;
    }
    const previousItems = allItems;
    // Move it on screen straight away, then save
    mutateItems(
      allItems.map((i) => (i.id === itemId ? { ...i, watchlist_group_id: targetGroupId } : i)),
      false
    );
    try {
      await move(itemId, targetGroupId);
      refreshAll();
    } catch {
      mutateItems(previousItems, false);
      setNotice(`Couldn't move ${item.ticker_symbol}. Try again.`);
    }
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveItem((e.active.data.current?.item as WatchlistItem | undefined) ?? null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setActiveItem(null);
    const item = e.active.data.current?.item as WatchlistItem | undefined;
    const target = e.over?.data.current?.groupId as number | undefined;
    if (item && target != null && target !== item.watchlist_group_id) {
      handleMoveItem(item.id, target);
      // A collapsed column that receives a stock opens so the stock is visible
      setExpandedGroups((prev) => new Set(prev).add(target));
    }
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const group = await create(trimmed);
    setExpandedGroups((prev) => new Set(prev).add(group.id));
    setNewName("");
    setIsCreating(false);
  };

  const handleAddItem = async (ticker: string, groupId: number) => {
    await addToWatchlist(ticker, groupId);
    refreshAll();
  };

  const handleRemoveItem = async (ticker: string, groupId: number) => {
    // Only from this watchlist; the same stock can sit in several
    mutateItems(
      allItems.filter((i) => !(i.ticker_symbol === ticker && i.watchlist_group_id === groupId)),
      false
    );
    await removeFromWatchlist(ticker, groupId);
    refreshAll();
  };

  const handleDeleteGroup = async (groupId: number) => {
    await removeGroup(groupId);
    refreshAll();
  };

  const atLimit = groups.length >= MAX_GROUPS;
  const createControl = isCreating ? (
    <div className="flex items-center gap-1">
      <Input
        ref={createInputRef}
        aria-label="New watchlist name"
        maxLength={40}
        className="h-9 w-48"
        placeholder="Watchlist name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
          if (e.key === "Escape") {
            setIsCreating(false);
            setNewName("");
          }
        }}
      />
      <Button variant="ghost" size="icon" aria-label="Create watchlist" onClick={handleCreate} disabled={!newName.trim()}>
        <Check className="size-4 text-sprout" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Cancel"
        onClick={() => {
          setIsCreating(false);
          setNewName("");
        }}
      >
        <X className="size-4" />
      </Button>
    </div>
  ) : (
    <Button onClick={() => setIsCreating(true)} disabled={atLimit} title={atLimit ? `You can have up to ${MAX_GROUPS} watchlists` : undefined}>
      <Plus className="size-4" />
      New watchlist
    </Button>
  );

  const header = (
    <PageHeader
      title="Watchlists"
      description={
        <>
          Stocks you&apos;re keeping an eye on, in up to <span className="num">{MAX_GROUPS}</span> lists. Drag a stock to move it
          between lists.
        </>
      }
      actions={createControl}
    />
  );

  if (groupsLoading || (itemsLoading && groups.length > 0)) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={<Bookmark />}
          title="No watchlists yet"
          description="Make a list for stocks you might buy, then add them here or with the bookmark on any stock's page."
          action={
            <>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="size-4" />
                New watchlist
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/screener/">Browse the screener</Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {notice && (
        <p role="status" className="rounded-lg border border-line bg-raised px-3 py-2 text-[13px] text-ink-2">
          {notice}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveItem(null)}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up ${(active.data.current?.item as WatchlistItem | undefined)?.ticker_symbol ?? "stock"}.`,
            onDragOver: ({ over }) => (over ? `Over ${groupName(over.data.current?.groupId as number)}.` : "Not over a watchlist."),
            onDragEnd: ({ over }) => (over ? `Dropped in ${groupName(over.data.current?.groupId as number)}.` : "Dropped."),
            onDragCancel: () => "Move cancelled.",
          },
        }}
      >
        <div className={cn("grid grid-cols-1 items-start gap-4", COLUMN_CLASSES[Math.min(groups.length, 4)])}>
          {groups.map((group) => (
            <WatchlistPanel
              key={group.id}
              group={group}
              groups={groups}
              items={itemsByGroup.get(group.id) ?? []}
              canDelete={groups.length > 1}
              isExpanded={expandedGroups.has(group.id)}
              onToggle={() => toggleGroup(group.id)}
              onRename={(id, name) => rename(id, name)}
              onDelete={handleDeleteGroup}
              onRemoveItem={handleRemoveItem}
              onMoveItem={handleMoveItem}
              onAddItem={handleAddItem}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="w-[min(320px,80vw)] cursor-grabbing rounded-lg border border-sprout/50 bg-raised px-2.5 py-2 shadow-pop">
              <WatchlistCardBody ticker={activeItem.ticker_symbol} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
