"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Info, Loader2, Download, AlertCircle } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import type { ImportSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AngelOneImport } from "./AngelOneImport";
import { BrokerImport, REVOLUT, ZERODHA } from "./BrokerImport";

type Source = "excel" | "zerodha" | "angelone" | "revolut";
const SOURCES: { value: Source; label: string }[] = [
  { value: "excel", label: "Spreadsheet" },
  { value: "zerodha", label: "Zerodha" },
  { value: "angelone", label: "Angel One" },
  { value: "revolut", label: "Revolut" },
];

const DESCRIPTIONS: Record<Source, string> = {
  excel: "Add many purchases at once from a spreadsheet. Each sheet becomes a portfolio.",
  zerodha: "Add your holdings from the trades in your Zerodha tradebook.",
  angelone: "Add your holdings from Angel One's holdings file.",
  revolut: "Add your holdings from the trades in your Revolut account statement.",
};

interface ImportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File) => Promise<ImportSummary>;
  onDownloadTemplate: () => Promise<void>;
  onComplete: () => void;
}

type DialogState = "idle" | "uploading" | "complete" | "error";

export function ImportExcelDialog({
  open,
  onOpenChange,
  onImport,
  onDownloadTemplate,
  onComplete,
}: ImportExcelDialogProps) {
  const [source, setSource] = useState<Source>("excel");
  const [state, setState] = useState<DialogState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setSource("excel");
    setState("idle");
    setSelectedFile(null);
    setResult(null);
    setError("");
    setIsDragOver(false);
    setShowDetails(false);
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const validateFile = (file: File): string | null => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return "Only .xlsx files are supported";
    }
    if (file.size > 5 * 1024 * 1024) {
      return "File size exceeds 5MB limit";
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }
    setError("");
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setState("uploading");
    setError("");
    try {
      const summary = await onImport(selectedFile);
      setResult(summary);
      setState("complete");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Import failed";
      setError(msg);
      setState("error");
    }
  };

  const handleDone = () => {
    onComplete();
    handleOpenChange(false);
  };

  const skippedItems = result?.details.filter((d) => d.status !== "created") ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn("sm:max-w-lg", source === "angelone" && "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>Import holdings</DialogTitle>
          <DialogDescription>{DESCRIPTIONS[source]}</DialogDescription>
        </DialogHeader>

        {state === "idle" && (
          <Segmented value={source} onChange={setSource} options={SOURCES} aria-label="Import from" className="w-fit" />
        )}

        {source === "zerodha" && <BrokerImport key="zerodha" broker={ZERODHA} onComplete={handleDone} />}
        {source === "revolut" && <BrokerImport key="revolut" broker={REVOLUT} onComplete={handleDone} />}
        {source === "angelone" && <AngelOneImport onComplete={handleDone} />}

        {/* Idle / Error state — file upload */}
        {source === "excel" && (state === "idle" || state === "error") && (
          <div className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              aria-label={selectedFile ? `Selected ${selectedFile.name}. Choose another file` : "Choose an .xlsx file"}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
                isDragOver
                  ? "border-sprout bg-sprout/10"
                  : selectedFile
                    ? "border-sprout/40 bg-sprout/5"
                    : "border-line-strong bg-well hover:border-ink-3/60 hover:bg-raised/40"
              )}
            >
              <div className="flex size-11 items-center justify-center rounded-xl border border-line bg-raised text-ink-2">
                {selectedFile ? <FileSpreadsheet className="size-5 text-sprout" /> : <Upload className="size-5" />}
              </div>
              {selectedFile ? (
                <div className="space-y-0.5">
                  <p className="text-[13.5px] font-medium text-ink">{selectedFile.name}</p>
                  <p className="text-[12px] text-ink-3">
                    <span className="num">{(selectedFile.size / 1024).toFixed(1)} KB</span> · click to choose another file
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-[13.5px] font-medium text-ink">Drop an .xlsx file here</p>
                  <p className="text-[12px] text-ink-3">or click to browse · up to 5 MB</p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = "";
              }}
            />

            {/* Instructions */}
            <div className="rounded-lg border border-line bg-raised p-3.5 text-[12.5px] text-ink-2">
              <p className="mb-1.5 text-[13px] font-medium text-ink">How it works</p>
              <ul className="list-disc space-y-1 pl-4 marker:text-ink-3">
                <li>Each sheet (tab) becomes a portfolio, up to 4</li>
                <li>Each row needs a ticker, date and quantity, plus the price per share or the total cost</li>
                <li>A sheet named like an existing portfolio is merged into it</li>
                <li>Rows already in your holdings (same ticker and date) are skipped</li>
              </ul>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2.5 rounded-lg border border-watch/30 bg-watch/10 p-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-watch" />
              <p className="text-[12.5px] text-watch">
                An import can&apos;t be undone. Export your current holdings first if you want a backup.
              </p>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-cut/30 bg-cut/10 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-cut" />
                <p className="text-[13px] text-cut">{error}</p>
              </div>
            )}

            <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={async (e) => { e.stopPropagation(); await onDownloadTemplate(); }}
              >
                <Download className="size-4" />
                Download template
              </Button>
              <Button onClick={handleImport} disabled={!selectedFile}>
                <Upload className="size-4" />
                Import
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Uploading state */}
        {state === "uploading" && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <Loader2 className="size-9 animate-spin text-sprout" />
            <p className="text-[13px] text-ink-2">Importing your holdings…</p>
          </div>
        )}

        {/* Complete state */}
        {state === "complete" && result && (
          <div className="space-y-4">
            {/* All-duplicates banner */}
            {result.created === 0 && result.skipped_duplicate > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-line bg-raised p-3">
                <Info className="mt-0.5 size-4 shrink-0 text-ink-2" />
                <div>
                  <p className="text-[13px] font-medium text-ink">Nothing new to add</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-2">Every row is already in your holdings.</p>
                </div>
              </div>
            )}

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2.5">
              <ResultTile label="Added" value={result.created} tone={result.created > 0 ? "money" : "default"} />
              <ResultTile label="Already there" value={result.skipped_duplicate} tone="default" />
              <ResultTile label="Couldn't read" value={result.skipped_invalid} tone={result.skipped_invalid > 0 ? "cut" : "default"} />
            </div>

            {/* Portfolio info */}
            {(result.portfolios_created.length > 0 || result.portfolios_merged.length > 0) && (
              <dl className="space-y-1 text-[13px]">
                {result.portfolios_created.length > 0 && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-3">New portfolios</dt>
                    <dd className="text-ink">{result.portfolios_created.join(", ")}</dd>
                  </div>
                )}
                {result.portfolios_merged.length > 0 && (
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-3">Merged into</dt>
                    <dd className="text-ink">{result.portfolios_merged.join(", ")}</dd>
                  </div>
                )}
              </dl>
            )}

            {/* Unknown stocks info banner */}
            {result.has_unknown_stocks && (
              <div className="flex items-start gap-2.5 rounded-lg border border-line bg-raised p-3">
                <Info className="mt-0.5 size-4 shrink-0 text-ink-2" />
                <p className="text-[12.5px] text-ink-2">
                  Dividends for the new stocks are being fetched in the background. The Data page shows progress.
                </p>
              </div>
            )}

            {/* Skipped details (collapsible) */}
            {skippedItems.length > 0 && (
              <div>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  aria-expanded={showDetails}
                  className="text-[12.5px] text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  {showDetails ? "Hide" : "Show"} skipped rows (<span className="num">{skippedItems.length}</span>)
                </button>
                {showDetails && (
                  <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-line bg-well p-1.5 text-[12px]">
                    {skippedItems.map((item, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5",
                          item.status === "skipped_invalid" && "bg-cut/5"
                        )}
                      >
                        <span className="num shrink-0 text-ink-2">
                          {item.sheet_name} · row {item.row_number} · <span className="text-ink">{item.ticker || "—"}</span>
                        </span>
                        <span className={cn("text-right", item.status === "skipped_invalid" ? "text-cut" : "text-ink-3")}>
                          {item.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleDone}>
                <CheckCircle2 className="size-4" />
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultTile({ label, value, tone }: { label: string; value: number; tone: "default" | "money" | "cut" }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 text-center",
        tone === "money" ? "border-sprout/25 bg-sprout/10" : tone === "cut" ? "border-cut/25 bg-cut/10" : "border-line bg-raised"
      )}
    >
      <p className={cn("num text-[22px] font-medium leading-none", tone === "money" ? "text-money" : tone === "cut" ? "text-cut" : "text-ink")}>
        {value}
      </p>
      <p className="mt-1.5 text-[11.5px] text-ink-3">{label}</p>
    </div>
  );
}
