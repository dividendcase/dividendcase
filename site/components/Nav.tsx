"use client";

import { useEffect, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { Logo } from "@dividendcase/brand/logo";
import { GitHubIcon } from "./icons";
import { GITHUB_URL, NAV_LINKS, buttonPrimary } from "./site";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the phone menu with Escape, or when the window grows past the breakpoint
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const wide = window.matchMedia("(min-width: 64rem)");
    const onWide = () => wide.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  const solid = scrolled || open;

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-md transition-colors duration-200 ${
        solid ? "border-line bg-ground/85" : "border-transparent bg-ground/60"
      }`}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <a href="#top" className="rounded-md text-[17px] text-ink" aria-label="DividendCase, back to top">
          <Logo />
        </a>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-7 text-[14px] text-ink-2">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="rounded-sm transition-colors hover:text-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            className="grid size-10 place-items-center rounded-[10px] text-ink-2 transition-colors hover:bg-raised hover:text-ink"
            aria-label="DividendCase on GitHub"
          >
            <GitHubIcon className="size-[18px]" />
          </a>
          <a href="#install" className={`${buttonPrimary} py-2! max-sm:hidden`}>
            Install for free
          </a>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-[10px] text-ink transition-colors hover:bg-raised lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" aria-hidden /> : <List className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        hidden={!open}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-y border-line bg-ground shadow-pop lg:hidden"
      >
        <nav aria-label="List" className="container-page py-3">
          <ul className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-lg px-2 py-3 text-[16px] text-ink-2 transition-colors hover:bg-surface hover:text-ink"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <a href="#install" onClick={() => setOpen(false)} className={`${buttonPrimary} mt-3 mb-2 w-full`}>
            Install for free
          </a>
        </nav>
      </div>
    </header>
  );
}
