"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3, Bookmark, CalendarDays, Database, FolderPlus, GitCompareArrows, Info, Layers,
  Lock, Settings, SlidersHorizontal, Sprout, X,
} from "lucide-react";
import { LogoMark } from "@dividendcase/brand/logo";
import { cn } from "@/lib/utils";
import { usePortfolios } from "@/lib/hooks/usePortfolios";
import { isBusy, useDataStatus } from "@/lib/hooks/useDataStatus";
import { timeAgo } from "@/lib/format";
import { UpdateNotice } from "@/components/layout/UpdateNotice";

const MAX_PORTFOLIOS = 4;

type NavItem = { href: string; label: string; Icon: React.ElementType };

const primaryNav: NavItem[] = [
  { href: "/dashboard", label: "Income", Icon: BarChart3 },
  { href: "/dashboard/investments", label: "Holdings", Icon: Layers },
  { href: "/dashboard/calendar", label: "Calendar", Icon: CalendarDays },
];

const researchNav: NavItem[] = [
  { href: "/dashboard/screener", label: "Screener", Icon: SlidersHorizontal },
  { href: "/dashboard/watchlist", label: "Watchlists", Icon: Bookmark },
  { href: "/dashboard/compare", label: "Compare", Icon: GitCompareArrows },
  { href: "/dashboard/drip", label: "DRIP calculator", Icon: Sprout },
];

const systemNav: NavItem[] = [
  { href: "/dashboard/data", label: "Data", Icon: Database },
  { href: "/dashboard/settings", label: "Settings", Icon: Settings },
  { href: "/dashboard/about", label: "About", Icon: Info },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/** The static export serves pages with a trailing slash; compare without it. */
function usePath() {
  return (usePathname() ?? "").replace(/(.)\/$/, "$1");
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/screener") return pathname === href || pathname === "/dashboard/stock";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, onClose, trailing }: { item: NavItem; pathname: string; onClose: () => void; trailing?: React.ReactNode }) {
  const active = isActive(pathname, item.href);
  const { Icon } = item;
  return (
    <Link
      href={`${item.href}/`}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2.5 py-[7px] text-[13.5px] font-medium transition-colors",
        active ? "bg-raised text-ink" : "text-ink-2 hover:bg-raised/60 hover:text-ink"
      )}
    >
      <Icon className={cn("size-[17px] shrink-0 transition-colors", active ? "text-sprout" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={1.8} />
      <span className="flex-1 truncate">{item.label}</span>
      {trailing}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2.5 pb-1 pt-5 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3/80">{children}</p>;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePath();
  const { portfolios, create } = usePortfolios();
  const { status } = useDataStatus();
  const busy = isBusy(status);
  const inHoldings = pathname.startsWith("/dashboard/investments");

  return (
    <>
      {/* Backdrop on small screens */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-ground/70 backdrop-blur-sm transition-opacity lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-line bg-well",
          "transition-transform duration-300 ease-out-soft",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-auto lg:w-[232px] lg:translate-x-0 lg:shrink-0"
        )}
        aria-label="Main"
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard/" onClick={onClose} className="flex items-center gap-2.5 rounded-md">
            <LogoMark className="size-7" />
            <span className="text-[16px] font-semibold tracking-[-0.015em]">
              <span className="text-sprout">Dividend</span>Case
            </span>
          </Link>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-3 hover:bg-raised hover:text-ink lg:hidden" aria-label="Close menu">
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
          <div className="space-y-0.5">
            {primaryNav.map((item) => (
              <div key={item.href}>
                <NavLink item={item} pathname={pathname} onClose={onClose} />
                {item.href === "/dashboard/investments" && inHoldings && (
                  <div className="my-1 ml-[21px] space-y-0.5 border-l border-line pl-3">
                    <SubLink href="/dashboard/investments/" active={pathname === "/dashboard/investments"} onClose={onClose}>
                      All portfolios
                    </SubLink>
                    <Suspense fallback={null}>
                      <PortfolioLinks portfolios={portfolios} pathname={pathname} onClose={onClose} />
                    </Suspense>
                    {portfolios.length < MAX_PORTFOLIOS && (
                      <button
                        onClick={() => create(`Portfolio ${portfolios.length + 1}`)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[12.5px] text-ink-3 transition-colors hover:text-ink"
                      >
                        <FolderPlus className="size-3.5" />
                        New portfolio
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <SectionLabel>Research</SectionLabel>
          <div className="space-y-0.5">
            {researchNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClose={onClose} />
            ))}
          </div>

          <SectionLabel>App</SectionLabel>
          <div className="space-y-0.5">
            {systemNav.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                onClose={onClose}
                trailing={
                  item.href === "/dashboard/data" && busy ? (
                    <span className="relative flex size-2" aria-label="Updating">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-sprout/60" />
                      <span className="relative inline-flex size-2 rounded-full bg-sprout" />
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        </nav>

        <UpdateNotice />

        {/* The privacy promise, with the data status behind it */}
        <Link
          href="/dashboard/data/"
          onClick={onClose}
          className="mx-3 mb-3 block rounded-xl border border-line bg-surface p-3 transition-colors hover:border-line-strong"
        >
          <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
            <Lock className="size-3.5 text-sprout" strokeWidth={2} />
            On this computer
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-ink-3">
            {!status
              ? "Your data stays here."
              : busy
                ? `Updating ${status.holdings.done + status.screener.done} of ${status.holdings.total + status.screener.total} stocks…`
                : `${status.stocks.toLocaleString()} stocks · updated ${timeAgo(status.last_runs.holdings.finished_at ?? status.last_runs.screener.finished_at)}`}
          </p>
        </Link>
      </aside>
    </>
  );
}

function SubLink({ href, active, onClose, children }: { href: string; active: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block truncate rounded-md px-2 py-1 text-[12.5px] transition-colors",
        active ? "text-ink" : "text-ink-3 hover:text-ink"
      )}
    >
      {children}
    </Link>
  );
}

function PortfolioLinks({
  portfolios,
  pathname,
  onClose,
}: {
  portfolios: { id: number; name: string }[];
  pathname: string;
  onClose: () => void;
}) {
  const activeId = useSearchParams().get("id");
  return (
    <>
      {portfolios.map((p) => (
        <SubLink
          key={p.id}
          href={`/dashboard/investments/portfolio/?id=${p.id}`}
          active={pathname === "/dashboard/investments/portfolio" && activeId === String(p.id)}
          onClose={onClose}
        >
          {p.name}
        </SubLink>
      ))}
    </>
  );
}
