"use client";

import Link from "next/link";
import { ArrowRight, Download, Layers, Lock, SlidersHorizontal, Upload } from "lucide-react";
import { LogoMark } from "@dividendcase/brand/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppActions } from "@/components/layout/AppActions";
import { downloadTemplate } from "@/lib/api/backend";
import { isBusy, useDataStatus } from "@/lib/hooks/useDataStatus";

/** The Income page before any holdings exist: three ways to start. */
export function Welcome() {
  const { openImport } = useAppActions();
  const { status } = useDataStatus();
  const fetching = isBusy(status);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-surface px-6 py-10 sm:px-10 sm:py-14">
        {/* The dial from the logo, turning slowly behind the welcome */}
        <svg
          aria-hidden="true"
          viewBox="0 0 400 400"
          className="pointer-events-none absolute -right-24 -top-24 size-[420px] opacity-40 motion-safe:animate-[spin_120s_linear_infinite] sm:-right-10"
        >
          <circle cx="200" cy="200" r="180" fill="none" stroke="#282834" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="148" fill="none" stroke="#22222c" strokeWidth="1" />
          {Array.from({ length: 36 }).map((_, i) => (
            <rect
              key={i}
              x="198.5"
              y={i % 3 === 0 ? 22 : 26}
              width="3"
              height={i % 3 === 0 ? 14 : 8}
              rx="1.5"
              fill={i % 3 === 0 ? "#5c5c70" : "#363645"}
              transform={`rotate(${i * 10} 200 200)`}
            />
          ))}
        </svg>
        <div className="relative max-w-xl space-y-4">
          <LogoMark className="size-12" />
          <h1 className="text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] text-ink sm:text-[40px]">
            Your dividends, on your <span className="serif-accent text-[1.12em]">own</span> computer.
          </h1>
          <p className="max-w-lg text-[15px] leading-relaxed text-ink-2">
            Add what you own and DividendCase shows what lands in your account, month by month, in each
            currency. Everything stays in one file on this computer.
          </p>
          <div className="flex items-center gap-2 pt-1 text-[12.5px] text-ink-3">
            <Lock className="size-3.5 text-sprout" />
            No account. Market data is fetched by this computer from Yahoo Finance.
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Step
          n={1}
          icon={<Upload />}
          title="Import from Excel"
          text="Bring your DividendCase export, or fill in the template with your broker's holdings: one row per purchase."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={openImport}>
                <Upload className="size-4" />
                Import a file
              </Button>
              <Button variant="ghost" size="sm" onClick={() => downloadTemplate()}>
                <Download className="size-3.5" />
                Template
              </Button>
            </div>
          }
        />
        <Step
          n={2}
          icon={<Layers />}
          title="Or add holdings by hand"
          text="Enter the ticker, number of shares, price and date of each purchase, in any currency."
          action={
            <Button variant="outline" asChild>
              <Link href="/dashboard/investments/">
                Add a holding
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
        <Step
          n={3}
          icon={<SlidersHorizontal />}
          title="Find dividend payers"
          text={
            status && status.stocks > 0
              ? `Browse ${status.stocks.toLocaleString()} stored stocks by yield, market and how often they pay.`
              : fetching
                ? "Index members are being fetched in the background, about one a second."
                : "Browse index members from six markets by yield, market and how often they pay."
          }
          action={
            <Button variant="outline" asChild>
              <Link href="/dashboard/screener/">
                Open the screener
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}

function Step({ n, icon, title, text, action }: { n: number; icon: React.ReactNode; title: string; text: string; action: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-raised text-sprout [&_svg]:size-[18px]">{icon}</span>
        <span className="num text-[12px] text-ink-3">0{n}</span>
      </div>
      <div className="space-y-1.5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        <p className="text-[13px] leading-relaxed text-ink-3">{text}</p>
      </div>
      <div className="mt-auto pt-1">{action}</div>
    </Card>
  );
}
