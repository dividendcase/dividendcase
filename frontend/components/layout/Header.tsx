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
    // The toolbar floats: glass capsules over the page, which scrolls up beneath them and fades
    // out under the top edge so the capsules stay legible
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2.5 bg-linear-to-b from-ground/90 via-ground/60 to-transparent px-4 sm:px-6 lg:px-8">
      <button
        onClick={onMenuToggle}
        className="glass-control flex size-9 items-center justify-center rounded-full border text-ink-2 transition-transform active:scale-95 hover:text-ink lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-[18px]" />
      </button>
      <LogoMark className="size-6 lg:hidden" />

      <button
        onClick={openCommand}
        className="glass group flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full border px-4 text-left text-[13px] text-ink-3 transition-[color,transform] duration-200 ease-out-soft hover:text-ink-2 active:scale-[0.99] sm:max-w-md"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">
          Search stocks<span className="hidden sm:inline"> or jump to a page</span>…
        </span>
        <kbd className="ml-auto hidden shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] text-ink-3 sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <DataIndicator />
      </div>
    </header>
  );
}
