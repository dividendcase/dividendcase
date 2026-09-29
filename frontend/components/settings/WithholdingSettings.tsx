"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/ui/tooltip";
import { useUserPreferences } from "@/lib/hooks/useUserPreferences";
import { useWithholding } from "@/lib/withholding";
import { cn } from "@/lib/utils";
import type { WithholdingRow } from "@/lib/types";

const BASIS_LABEL: Record<string, string> = {
  treaty: "Treaty rate",
  statutory: "Standard rate",
  domestic: "Resident rate",
  none: "Not withheld",
  override: "Your rate",
};

/** Settings → what each paying country withholds for the user's tax residence. */
export function WithholdingSettings() {
  const { table } = useWithholding();
  const { updatePreference } = useUserPreferences();

  return (
    <Card id="withholding" className="scroll-mt-20">
      <CardHeader className="border-b border-line">
        <CardTitle>Tax withheld at source</CardTitle>
        <CardDescription>
          {table?.residence
            ? `What each country keeps before a dividend reaches you, for a resident of ${table.residence_name}. `
            : "Choose your tax residence above to see what each country keeps before a dividend reaches you. "}
          Estimates, not tax advice: if your broker takes a different rate, set it here.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 sm:pt-5">
        {!table ? (
          <Skeleton className="h-40 w-full" />
        ) : !table.residence ? null : (
          <ul className="divide-y divide-line">
            {table.rows.map((row) => (
              <Row
                key={row.source}
                row={row}
                onChange={(rate) => updatePreference({ withholding_overrides: { [row.source]: rate } })}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ row, onChange }: { row: WithholdingRow; onChange: (rate: number | null) => void }) {
  const [text, setText] = useState(row.rate == null ? "" : String(row.rate));
  useEffect(() => setText(row.rate == null ? "" : String(row.rate)), [row.rate]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === "") {
      if (row.basis === "override") onChange(null);
      return;
    }
    const value = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setText(row.rate == null ? "" : String(row.rate));
      return;
    }
    // Typing the estimate back in is the same as having no override
    if (row.default_rate != null && value === row.default_rate) {
      if (row.basis === "override") onChange(null);
      return;
    }
    if (value !== row.rate) onChange(value);
  };

  const overridden = row.basis === "override";
  return (
    <li className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[13.5px] font-medium text-ink">{row.name}</p>
          <span className={cn("text-[11.5px]", overridden ? "text-sprout-hi" : "text-ink-3")}>
            {row.basis ? BASIS_LABEL[row.basis] ?? row.basis : "Not estimated yet"}
          </span>
          <InfoTip label={`About ${row.name}`}>{overridden && row.default_note ? `Estimate: ${row.default_rate}%. ${row.default_note}` : row.note}</InfoTip>
        </div>
        {row.your_stocks.length > 0 && (
          <p className="mt-0.5 truncate text-[12px] text-ink-3">
            Your stocks: <span className="num">{row.your_stocks.slice(0, 6).join(", ")}</span>
            {row.your_stocks.length > 6 && ` and ${row.your_stocks.length - 6} more`}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {overridden && (
          <button onClick={() => onChange(null)} className="text-[12px] text-ink-3 hover:text-ink">
            Use estimate ({row.default_rate ?? "—"}%)
          </button>
        )}
        <div className="relative w-24">
          <Input
            inputMode="decimal"
            aria-label={`Withholding rate for ${row.name}`}
            placeholder="—"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className="num h-8 pr-7 text-right"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-ink-3">%</span>
        </div>
      </div>
    </li>
  );
}
