"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Check, Copy, Download, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppActions } from "@/components/layout/AppActions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserPreferences } from "@/lib/hooks/useUserPreferences";
import { useAppInfo } from "@/lib/hooks/useAppInfo";
import { useFxRates } from "@/lib/fx";
import { getScreenerMarkets } from "@/lib/api/backend";
import { CURRENCY_NAMES, TAX_RESIDENCES } from "@/lib/regions";
import { Chip } from "@/components/ui/segmented";
import type { ScreenerMarket } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";

const BENCHMARK_OPTIONS = [
  { value: "SP500", label: "S&P 500", ticker: "SPY" },
  { value: "FTSE100", label: "FTSE 100", ticker: "ISF.L" },
  { value: "NIFTY50", label: "Nifty 50", ticker: "^NSEI" },
  { value: "ASX200", label: "S&P/ASX 200", ticker: "STW.AX" },
  { value: "TSX60", label: "S&P/TSX 60", ticker: "XIU.TO" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "DD/MM/YYYY", example: "31/12/2025" },
  { value: "MM/DD/YYYY", example: "12/31/2025" },
  { value: "YYYY-MM-DD", example: "2025-12-31" },
];

/** A setting: what it is on the left, the control on the right (stacked on phones). */
function SettingRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0 space-y-1">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-[13.5px] text-ink">
            {title}
          </Label>
        ) : (
          <p className="text-[13.5px] font-medium leading-none text-ink">{title}</p>
        )}
        {description && <p className="text-[12.5px] leading-relaxed text-ink-3">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b border-line">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="divide-y divide-line pt-4 sm:pt-5">{children}</CardContent>
    </Card>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
        checked ? "border-sprout/60 bg-sprout" : "border-line-strong bg-overlay"
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full shadow-sm transition-transform duration-200 ease-out-soft",
          checked ? "translate-x-[22px] bg-sprout-ink" : "translate-x-[3px] bg-ink-2"
        )}
      />
    </button>
  );
}

export function SettingsView() {
  const { preferences, updatePreference, isLoading } = useUserPreferences();
  const { exportExcel, openImport } = useAppActions();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { info: appInfo, isLoading: appInfoLoading } = useAppInfo();
  const { fx } = useFxRates();
  const { data: markets } = useSWR<ScreenerMarket[]>("screener-markets", getScreenerMarkets, { revalidateOnFocus: false });
  const homeCurrencies = useMemo(() => {
    const available = fx?.date ? Object.keys(fx.rates) : Object.keys(CURRENCY_NAMES);
    return Array.from(new Set(["EUR", ...available]))
      .filter((c) => CURRENCY_NAMES[c])
      .sort((a, b) => CURRENCY_NAMES[a].localeCompare(CURRENCY_NAMES[b]));
  }, [fx]);
  const appInfoLoaded = !appInfoLoading;
  const [copied, setCopied] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportExcel();
    } catch {
      setExportError("The export didn't work. Try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const copyPath = async () => {
    if (!appInfo?.data_dir) return;
    try {
      await navigator.clipboard.writeText(appInfo.data_dir);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the path is still selectable
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Everything here is stored on this computer." />

      <Section title="This computer" description="Where DividendCase keeps your data. Back up this folder to keep a copy.">
        <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
          <p className="text-[13.5px] font-medium leading-none text-ink">Data folder</p>
          {!appInfoLoaded ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-line bg-well py-1 pl-3 pr-1">
              <code className="num min-w-0 flex-1 select-all break-all py-1 text-[12.5px] text-ink-2">{appInfo?.data_dir ?? "Unknown"}</code>
              {appInfo?.data_dir && (
                <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Copy folder path" onClick={copyPath}>
                  {copied ? <Check className="size-3.5 text-sprout" /> : <Copy className="size-3.5" />}
                </Button>
              )}
            </div>
          )}
        </div>
        <SettingRow
          title="Backups"
          description={
            <>
              Before an update changes your data, the app saves a copy in{" "}
              <code className="num break-all text-ink-2">{appInfo?.backup_dir ?? "the backups folder"}</code>. The last five are kept.
            </>
          }
        >
          <span className="text-[12.5px] text-ink-3">Automatic</span>
        </SettingRow>
        <SettingRow
          title="Version"
          description={
            appInfo?.update_available ? (
              <span className="text-sprout-hi">
                Version <span className="num">{appInfo.latest_version}</span> is out. Run{" "}
                <code className="num text-ink">{appInfo.upgrade_command}</code>, then start DividendCase again.
              </span>
            ) : undefined
          }
        >
          {!appInfoLoaded ? <Skeleton className="h-4 w-16" /> : <span className="num text-[13px] text-ink-2">{appInfo?.version ?? "—"}</span>}
        </SettingRow>
      </Section>

      <Section title="Region and markets" description="Your answers from the first-run setup.">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <SettingRow
              title="Tax residence"
              description="Later versions use this to show income after withholding tax."
              htmlFor="pref-residence"
            >
              <Select value={preferences.tax_residence ?? ""} onValueChange={(v) => updatePreference({ tax_residence: v })}>
                <SelectTrigger id="pref-residence" className="w-full sm:w-56">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  {TAX_RESIDENCES.map((r) => (
                    <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow
              title="Home currency"
              description={
                fx?.date
                  ? `Totals are converted with European Central Bank rates (latest: ${fx.date}).`
                  : "Totals are converted with European Central Bank rates once they have downloaded."
              }
              htmlFor="pref-currency"
            >
              <Select value={preferences.home_currency ?? ""} onValueChange={(v) => updatePreference({ home_currency: v })}>
                <SelectTrigger id="pref-currency" className="w-full sm:w-56">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  {homeCurrencies.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="num mr-2 text-ink">{c}</span>
                      {CURRENCY_NAMES[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
            <div className="space-y-3 py-4 first:pt-0 last:pb-0">
              <div className="space-y-1">
                <p className="text-[13.5px] font-medium leading-none text-ink">Screener markets</p>
                <p className="text-[12.5px] leading-relaxed text-ink-3">
                  Which index members the app downloads for the screener. Stocks already downloaded stay.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(markets ?? []).map((m) => {
                  const chosen = preferences.screener_markets == null || preferences.screener_markets.includes(m.key);
                  return (
                    <Chip
                      key={m.key}
                      active={chosen}
                      onClick={() => {
                        const current = preferences.screener_markets ?? (markets ?? []).map((x) => x.key);
                        const next = chosen ? current.filter((k) => k !== m.key) : [...current, m.key];
                        updatePreference({ screener_markets: next.length === (markets ?? []).length ? null : next });
                      }}
                      title={`${m.country} · ${m.stocks} stocks`}
                    >
                      {m.name}
                    </Chip>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </Section>

      <Section title="Preferences">
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <SettingRow
              title="Default benchmark"
              description="What a stock is first compared with in its investment chart."
              htmlFor="pref-benchmark"
            >
              <Select value={preferences.default_benchmark} onValueChange={(v) => updatePreference({ default_benchmark: v })}>
                <SelectTrigger id="pref-benchmark" className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BENCHMARK_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                      <span className="num ml-2 text-ink-3">{o.ticker}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow title="Date format" description="Used for purchase and dividend dates." htmlFor="pref-date-format">
              <Select value={preferences.date_format} onValueChange={(v) => updatePreference({ date_format: v })}>
                <SelectTrigger id="pref-date-format" className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="num">{o.example}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow
              title="Start watchlists collapsed"
              description="Each watchlist opens showing only its name and count."
            >
              <Switch
                label="Start watchlists collapsed"
                checked={preferences.watchlist_collapsed}
                onChange={(v) => updatePreference({ watchlist_collapsed: v })}
              />
            </SettingRow>

            <SettingRow
              title="Check for updates"
              description="Once a day, asks PyPI (where DividendCase is published) for the newest version number. Nothing about you or your portfolio is sent."
            >
              <Switch
                label="Check for updates"
                checked={preferences.check_for_updates}
                onChange={(v) => updatePreference({ check_for_updates: v })}
              />
            </SettingRow>
          </>
        )}
      </Section>

      <Section title="Your data">
        <SettingRow
          title="Export to Excel"
          description={
            exportError ? (
              <span className="text-cut">{exportError}</span>
            ) : (
              "Your portfolios, holdings and watchlists in one spreadsheet. It can be imported again."
            )
          }
        >
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            <Download className="size-3.5" />
            {isExporting ? "Exporting…" : "Export"}
          </Button>
        </SettingRow>
        <SettingRow title="Import from Excel" description="Add purchases from a spreadsheet. Each sheet becomes a portfolio.">
          <Button variant="outline" size="sm" onClick={openImport}>
            <Upload className="size-3.5" />
            Import
          </Button>
        </SettingRow>
      </Section>

      <Section title="Danger zone" className="border-cut/35">
        <SettingRow
          title="Delete all my data"
          description="Permanently deletes your portfolios, holdings, watchlists and settings from this computer. Downloaded market data is kept."
        >
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="size-3.5" />
            Delete my data
          </Button>
        </SettingRow>
      </Section>

      <DeleteAccountDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
    </div>
  );
}
