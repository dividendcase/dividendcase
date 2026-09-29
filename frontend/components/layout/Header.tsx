"use client";

import { Menu, Search } from "lucide-react";
import { LogoMark } from "@dividendcase/brand/logo";
import { DataIndicator } from "@/components/data/DataIndicator";
import { useAppActions } from "@/components/layout/AppActions";

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { openCommand } = useAppActions();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-ground/85 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onMenuToggle}
        className="-ml-1.5 rounded-md p-1.5 text-ink-2 hover:bg-raised hover:text-ink lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      <LogoMark className="size-6 lg:hidden" />

      <button
        onClick={openCommand}
        className="group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line bg-surface px-3 text-left text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2 sm:max-w-md"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">
          Search stocks<span className="hidden sm:inline"> or jump to a page</span>…
        </span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-line bg-well px-1.5 py-0.5 font-mono text-[10.5px] text-ink-3 sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <DataIndicator />
      </div>
    </header>
  );
}
