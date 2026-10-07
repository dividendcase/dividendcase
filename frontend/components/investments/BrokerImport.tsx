"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Info, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { importRevolut, importZerodha, previewRevolut, previewZerodha } from "@/lib/api/backend";
import { formatMoney } from "@/lib/format";
import { usePortfolios } from "@/lib/hooks/usePortfolios";
import type { BrokerImportResult, BrokerPreview } from "@/lib/types";
import { cn } from "@/lib/utils";

type Step = "choose" | "reading" | "preview" | "importing" | "done";

/** A broker whose export lists trades: the files it takes, how to get them, and its API calls */
export interface BrokerSpec {
  name: string;
  /** What the broker calls the file: "tradebook", "statement" */
  file: string;
  extensions: string[];
  instructions: React.ReactNode;
  /** What to do when more was sold than the files show being bought */
  oversoldHint: string;
  /** What the files can't show, said under every preview */
  caveat: string;
  preview: (files: File[]) => Promise<BrokerPreview>;
  commit: (files: File[], portfolioId?: number) => Promise<BrokerImportResult>;
}

function Steps({ title, steps, after }: { title: string; steps: string[]; after: string }) {
  return (
    <div className="rounded-lg border border-line bg-raised p-3.5 text-[12.5px] text-ink-2">
      <p className="mb-1.5 text-[13px] font-medium text-ink">{title}</p>
      <ol className="list-decimal space-y-1 pl-4 marker:text-ink-3">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="mt-2 text-ink-3">{after}</p>
    </div>
  );
}

export const ZERODHA: BrokerSpec = {
  name: "Zerodha",
  file: "tradebook",
  extensions: [".csv", ".xlsx"],
  instructions: (
    <Steps
      title="Download your tradebook from Zerodha Console"
      steps={[
        "Open Console, then Reports, then Tradebook",
        "Choose Equity and a date range (Console allows up to a year at a time)",
        "Download it as CSV or Excel",
      ]}
      after="Add one file for each year since your first purchase, so each sale is matched with the right buy."
    />
  ),
  oversoldHint: "Add the tradebooks for earlier years, or add bonus shares and transfers by hand.",
  caveat: "Bonus shares, splits and transfers in don't appear in a tradebook: check those holdings afterwards.",
  preview: previewZerodha,
  commit: importZerodha,
};

export const REVOLUT: BrokerSpec = {
  name: "Revolut",
  file: "statement",
  extensions: [".pdf", ".csv", ".xlsx"],
  instructions: (
    <Steps
      title="Download your account statement from Revolut"
      steps={[
        "In the Revolut app, get an account statement for your stocks account",
        "Set the period to start on the day you opened the account",
        "Download it as PDF or Excel",
      ]}
      after="A statement that covers your whole history has every buy and sell, so each sale is matched with the right buy."
    />
  ),
  oversoldHint: "Add statements that go back to the day you opened the account, or add transfers by hand.",
  caveat: "Stock splits and transfers in don't appear as trades: check those holdings afterwards.",
  preview: previewRevolut,
  commit: importRevolut,
};

/**
 * Import from a broker's trade history (Zerodha tradebooks, Revolut statements): the user downloads the
 * files and chooses them here. The app reads them, shows the holdings they add up to, and adds the lots
 * that aren't there yet. It never connects to the broker.
 */
export function BrokerImport({ broker, onComplete }: { broker: BrokerSpec; onComplete: () => void }) {
  const [step, setStep] = useState<Step>("choose");
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<BrokerPreview | null>(null);
  const [result, setResult] = useState<BrokerImportResult | null>(null);
  const [error, setError] = useState("");
  const [portfolioId, setPortfolioId] = useState<number | undefined>(undefined);
  const { portfolios } = usePortfolios();

  const add = (picked: File[]) => {
    const accepted = picked.filter((f) => broker.extensions.some((ext) => f.name.toLowerCase().endsWith(ext)));
    if (accepted.length < picked.length) setError(`Only ${broker.extensions.join(", ")} ${broker.file}s can be read`);
    else setError("");
    // The same file chosen twice counts once
    setFiles((current) => [...current, ...accepted.filter((f) => !current.some((c) => c.name === f.name && c.size === f.size))]);
  };

  const read = async () => {
    setStep("reading");
    setError("");
    try {
      setPreview(await broker.preview(files));
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read these files");
      setStep("choose");
    }
  };

  const commit = async () => {
    setStep("importing");
    setError("");
    try {
      setResult(await broker.commit(files, portfolioId ?? portfolios[0]?.id));
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import failed");
      setStep("preview");
    }
  };

  if (step === "reading" || step === "importing") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="size-9 animate-spin text-sprout" />
        <p className="text-[13px] text-ink-2">{step === "reading" ? `Reading your ${broker.file}s…` : "Adding your holdings…"}</p>
      </div>
    );
  }

  if (step === "done" && result) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <Tile label="Lots added" value={result.created} money={result.created > 0} />
          <Tile label="Already there" value={result.already_there} />
        </div>
        {result.created > 0 && (
          <Note icon={Info}>Prices and dividends for new stocks are being fetched in the background. The Data page shows progress.</Note>
        )}
        <DialogFooter>
          <Button onClick={onComplete}>
            <CheckCircle2 className="size-4" />
            Done
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (step === "preview" && preview) {
    const range = preview.files
      .flatMap((f) => [f.first, f.last])
      .filter((d): d is string => !!d)
      .sort();
    const trades = preview.files.reduce((n, f) => n + f.trades, 0);
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-ink-2">
          <span className="num text-ink">{trades}</span> {trades === 1 ? "trade" : "trades"}
          {range.length > 0 &&
            (range[0] === range[range.length - 1] ? (
              <>
                {" "}on <span className="num">{range[0]}</span>
              </>
            ) : (
              <>
                {" "}from <span className="num">{range[0]}</span> to <span className="num">{range[range.length - 1]}</span>
              </>
            ))}{" "}
          {trades === 1 ? "adds" : "add"} up to <span className="num text-ink">{preview.holdings.length}</span>{" "}
          {preview.holdings.length === 1 ? "holding" : "holdings"}.
        </p>

        {preview.holdings.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-raised text-left text-[11px] text-ink-3">
                <tr>
                  <th className="px-3 py-2 font-medium">Stock</th>
                  <th className="px-3 py-2 text-right font-medium">Shares</th>
                  <th className="px-3 py-2 text-right font-medium">Average price</th>
                  <th className="px-3 py-2 text-right font-medium">New lots</th>
                </tr>
              </thead>
              <tbody>
                {preview.holdings.map((h) => {
                  const fresh = h.lots.filter((l) => !l.already_there).length;
                  return (
                    <tr key={h.isin} className="border-t border-line">
                      <td className="num px-3 py-2 text-ink">{h.ticker}</td>
                      <td className="num px-3 py-2 text-right text-ink-2">{h.quantity}</td>
                      <td className="num px-3 py-2 text-right text-ink-2">{formatMoney(h.average_price, h.currency)}</td>
                      <td className={cn("num px-3 py-2 text-right", fresh ? "text-money" : "text-ink-3")}>
                        {fresh} of {h.lots.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {preview.oversold.length > 0 && (
          <Note icon={AlertTriangle} tone="watch">
            More was sold than these files show being bought for {preview.oversold.join(", ")}. {broker.oversoldHint}
          </Note>
        )}
        {(preview.notes ?? []).map((note) => (
          <Note key={note} icon={AlertTriangle} tone="watch">
            {note}
          </Note>
        ))}
        <ul className="space-y-1 text-[12px] text-ink-3">
          {preview.closed > 0 && (
            <li>
              {plural(preview.closed, "stock was", "stocks were")} sold completely, so there&apos;s nothing to add for{" "}
              {preview.closed === 1 ? "it" : "them"}.
            </li>
          )}
          {preview.duplicate_trades > 0 && (
            <li>{plural(preview.duplicate_trades, "trade appeared", "trades appeared")} in more than one file and count once.</li>
          )}
          {preview.not_equity > 0 && (
            <li>{plural(preview.not_equity, "row", "rows")} for derivatives, currencies or commodities were left out.</li>
          )}
          {Object.keys(preview.left_out ?? {}).length > 0 && (
            <li>
              Only buys and sells become holdings, so these were left out:{" "}
              {Object.entries(preview.left_out ?? {})
                .map(([kind, n]) => `${n} ${kind.toLowerCase()}`)
                .join(", ")}
              .
            </li>
          )}
          <li>{broker.caveat}</li>
        </ul>
        {preview.unreadable.length > 0 && (
          <Note icon={AlertTriangle} tone="cut">
            Couldn&apos;t read {plural(preview.unreadable.length, "row", "rows")}: {preview.unreadable.slice(0, 3).join("; ")}
            {preview.unreadable.length > 3 && "…"}
          </Note>
        )}

        {portfolios.length > 1 && (
          <label className="flex items-center justify-between gap-3 text-[13px] text-ink-2">
            Add to
            <select
              value={portfolioId ?? portfolios[0]?.id}
              onChange={(e) => setPortfolioId(Number(e.target.value))}
              className="h-9 rounded-md border border-line bg-well px-2.5 text-[13px] text-ink"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && <Note icon={AlertTriangle} tone="cut">{error}</Note>}

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStep("choose")}>
            Back
          </Button>
          <Button onClick={commit} disabled={preview.new_lots === 0}>
            <Upload className="size-4" />
            {preview.new_lots === 0 ? "Nothing new to add" : `Add ${preview.new_lots} ${preview.new_lots === 1 ? "lot" : "lots"}`}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {broker.instructions}

      <FileDrop
        accept={broker.extensions.join(",")}
        multiple
        label={`Choose ${broker.file} files`}
        title={`Drop ${broker.file} files here`}
        hint={`or click to browse · ${broker.extensions.join(", ").replace(/, ([^,]*)$/, " or $1")}`}
        onFiles={add}
      />

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center gap-2.5 rounded-md border border-line bg-raised px-3 py-2 text-[12.5px]">
              <FileText className="size-4 shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
              <span className="num text-ink-3">{(f.size / 1024).toFixed(1)} KB</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles((current) => current.filter((c) => c !== f))}
                className="text-ink-3 hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[12px] text-ink-3">
        The files are read on this computer and not kept. DividendCase never connects to {broker.name}.
      </p>

      {error && <Note icon={AlertTriangle} tone="cut">{error}</Note>}

      <DialogFooter>
        <Button onClick={read} disabled={files.length === 0}>
          Read {files.length > 1 ? `${files.length} files` : "file"}
        </Button>
      </DialogFooter>
    </div>
  );
}

/** A drop zone that also opens the file picker (click, Enter or Space) */
export function FileDrop({
  accept,
  multiple = false,
  label,
  title,
  hint,
  onFiles,
}: {
  accept: string;
  multiple?: boolean;
  label: string;
  title: string;
  hint: string;
  onFiles: (files: File[]) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          onFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            input.current?.click();
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-7 text-center transition-colors",
          isDragOver ? "border-sprout bg-sprout/10" : "border-line-strong bg-well hover:border-ink-3/60 hover:bg-raised/40",
        )}
      >
        <Upload className="size-5 text-ink-2" />
        <p className="text-[13.5px] font-medium text-ink">{title}</p>
        <p className="text-[12px] text-ink-3">{hint}</p>
      </div>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </>
  );
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function Tile({ label, value, money = false }: { label: string; value: number; money?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5 text-center", money ? "border-sprout/25 bg-sprout/10" : "border-line bg-raised")}>
      <p className={cn("num text-[22px] leading-none font-medium", money ? "text-money" : "text-ink")}>{value}</p>
      <p className="mt-1.5 text-[11.5px] text-ink-3">{label}</p>
    </div>
  );
}

export function Note({
  icon: Icon,
  tone = "default",
  children,
}: {
  icon: typeof Info;
  tone?: "default" | "watch" | "cut";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "cut" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 text-[12.5px]",
        tone === "watch" ? "border-watch/30 bg-watch/10 text-watch" : tone === "cut" ? "border-cut/30 bg-cut/10 text-cut" : "border-line bg-raised text-ink-2",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
