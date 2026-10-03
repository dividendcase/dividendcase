"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Info, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImportRefused, importLots, previewAngelOne } from "@/lib/api/backend";
import { formatMoney } from "@/lib/format";
import { usePortfolios } from "@/lib/hooks/usePortfolios";
import type { BrokerImportResult, HoldingsFileLot, HoldingsFilePreview, HoldingsFileRow, LotToAdd } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FileDrop, Note, Tile, plural } from "./BrokerImport";

type Step = "choose" | "reading" | "preview" | "importing" | "done";

const TICKER = /^[A-Z0-9.\-^=&]+$/;
const lotKey = (isin: string, held: string) => `${isin}:${held}`;
/** Today on this computer, as YYYY-MM-DD */
const today = () => new Date().toLocaleDateString("en-CA");

/**
 * Import from Angel One: the user downloads "Your Holding Details" (Excel, protected with a password)
 * and chooses it here. The file names each holding by ISIN and gives no purchase dates, only how much
 * has been held for more than a year, so the preview lets the user fix tickers and dates before adding.
 * It never connects to Angel One.
 */
export function AngelOneImport({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<HoldingsFilePreview | null>(null);
  const [tickers, setTickers] = useState<Record<string, string>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  // One date for everything held more than a year; any lot's own date overrides it
  const [longDate, setLongDate] = useState("");
  const [dates, setDates] = useState<Record<string, string>>({});
  const [result, setResult] = useState<BrokerImportResult | null>(null);
  const [error, setError] = useState("");
  const [portfolioId, setPortfolioId] = useState<number | undefined>(undefined);
  const { portfolios } = usePortfolios();

  const choose = (picked: File[]) => {
    const [first] = picked;
    if (!first) return;
    if (!/\.(xlsx|csv|pdf)$/i.test(first.name)) {
      setError("Choose the .xlsx file Angel One gave you (or a .csv or .pdf copy of it)");
      return;
    }
    setFile(first);
    setNeedsPassword(false);
    setPassword("");
    setError("");
  };

  const read = async (chosen: File, pw?: string) => {
    setStep("reading");
    setError("");
    try {
      const p = await previewAngelOne(chosen, pw);
      setPreview(p);
      setTickers(Object.fromEntries(p.holdings.map((h) => [h.isin, h.ticker ?? ""])));
      setIncluded(Object.fromEntries(p.holdings.map((h) => [h.isin, h.ticker !== null])));
      setLongDate(p.holdings.flatMap((h) => h.lots).find((l) => l.held === "long")?.purchase_date ?? "");
      setDates({});
      setPassword(""); // the file is open; the password isn't kept
      setNeedsPassword(false);
      setStep("preview");
    } catch (e) {
      if (e instanceof ImportRefused && (e.code === "password_required" || e.code === "wrong_password")) {
        setNeedsPassword(true);
        setError(e.code === "wrong_password" ? e.message : "");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't read this file");
      }
      setStep("choose");
    }
  };

  const dateOf = (h: HoldingsFileRow, lot: HoldingsFileLot) =>
    dates[lotKey(h.isin, lot.held)] ?? (lot.held === "long" && longDate ? longDate : lot.purchase_date);

  const tickerOf = (h: HoldingsFileRow) => (tickers[h.isin] ?? "").trim().toUpperCase();

  const chosen: LotToAdd[] = (preview?.holdings ?? []).flatMap((h) =>
    included[h.isin] && tickerOf(h)
      ? h.lots.map((lot) => ({
          ticker: tickerOf(h),
          purchase_date: dateOf(h, lot),
          quantity: lot.quantity,
          price: lot.price,
          currency: h.currency,
        }))
      : [],
  );
  const problem = chosen.some((l) => !l.purchase_date)
    ? "Every holding needs a purchase date"
    : chosen.some((l) => l.purchase_date > today())
      ? "A purchase date can't be in the future"
      : chosen.some((l) => !TICKER.test(l.ticker))
        ? "A ticker can only use letters, digits and . - ^ = &"
        : "";
  const holdingsChosen = new Set(chosen.map((l) => l.ticker)).size;

  const commit = async () => {
    setStep("importing");
    setError("");
    try {
      setResult(await importLots(chosen, portfolioId ?? portfolios[0]?.id));
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
        <p className="text-[13px] text-ink-2">
          {step === "reading" ? "Reading the file and looking up tickers…" : "Adding your holdings…"}
        </p>
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
    const notFound = preview.holdings.filter((h) => !h.ticker);
    const hasLong = preview.holdings.some((h) => h.lots.some((l) => l.held === "long"));
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-ink-2">
          <span className="num text-ink">{preview.holdings.length}</span> holdings
          {preview.as_of && (
            <>
              {" "}on <span className="num">{preview.as_of}</span>
            </>
          )}
          .
        </p>
        <Note icon={Info}>
          Angel One&apos;s file doesn&apos;t say when you bought each holding, only whether it was more than a year
          ago, so each one is dated as late as it could have been bought. Change the dates if you know them: they
          decide which past dividends count.
        </Note>

        {hasLong && (
          <label className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-2">
            Held for more than a year: bought on
            <Input
              type="date"
              className="num h-9 w-[156px]"
              value={longDate}
              max={today()}
              onChange={(e) => setLongDate(e.target.value)}
            />
          </label>
        )}

        <div className="max-h-[22rem] overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-raised text-left text-[11px] text-ink-3">
              <tr>
                <th className="w-8 px-2.5 py-2 font-medium">
                  <span className="sr-only">Include</span>
                </th>
                <th className="px-2.5 py-2 font-medium">Stock</th>
                <th className="px-2.5 py-2 text-right font-medium">Shares</th>
                <th className="px-2.5 py-2 text-right font-medium whitespace-nowrap">Average price</th>
                <th className="px-2.5 py-2 font-medium">Bought</th>
              </tr>
            </thead>
            <tbody>
              {preview.holdings.map((h) => {
                const on = included[h.isin];
                return (
                  <tr key={h.isin} className={cn("border-t border-line align-top", !on && "opacity-55")}>
                    <td className="px-2.5 py-2.5">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => setIncluded((c) => ({ ...c, [h.isin]: e.target.checked }))}
                        aria-label={`Include ${h.name}`}
                        className="mt-2 size-3.5 accent-[var(--color-sprout)]"
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      {h.ticker ? (
                        <span className="num leading-7 text-ink">{h.ticker}</span>
                      ) : (
                        <Input
                          value={tickers[h.isin] ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setTickers((c) => ({ ...c, [h.isin]: value }));
                            setIncluded((c) => ({ ...c, [h.isin]: value.trim() !== "" }));
                          }}
                          placeholder="Ticker"
                          aria-label={`Ticker for ${h.name}`}
                          className="num h-7 w-28 px-2 text-[12px]"
                        />
                      )}
                      <p className="text-[11.5px] leading-snug text-ink-3">
                        {h.name}
                        {!h.ticker && " · not found on NSE or BSE"}
                      </p>
                    </td>
                    <td className="num px-2.5 py-2 text-right leading-7 text-ink-2">{h.quantity}</td>
                    <td className="num px-2.5 py-2 text-right leading-7 text-ink-2">
                      {h.average_price ? formatMoney(h.average_price, h.currency) : "none"}
                    </td>
                    <td className="space-y-1 px-2.5 py-2">
                      {h.lots.map((lot) => (
                        <div key={lot.held} className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={dateOf(h, lot)}
                            max={today()}
                            onChange={(e) => setDates((c) => ({ ...c, [lotKey(h.isin, lot.held)]: e.target.value }))}
                            aria-label={`Purchase date for ${h.name}${h.lots.length > 1 ? `, ${lot.quantity} held ${lot.held === "long" ? "over a year" : "under a year"}` : ""}`}
                            className="num h-7 w-[132px] px-2 text-[12px]"
                          />
                          {h.lots.length > 1 && (
                            <span className="num text-[11.5px] whitespace-nowrap text-ink-3">
                              {lot.quantity} {lot.held === "long" ? "over a year" : "this year"}
                            </span>
                          )}
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ul className="space-y-1 text-[12px] text-ink-3">
          {notFound.length > 0 && (
            <li>
              {plural(notFound.length, "holding wasn't", "holdings weren't")} found on NSE or BSE (unlisted or delisted).
              Type a ticker to include {notFound.length === 1 ? "it" : "one"}.
            </li>
          )}
          <li>Bonus shares and splits are already in Angel One&apos;s quantities and average prices.</li>
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

        {(error || problem) && <Note icon={AlertTriangle} tone="cut">{error || problem}</Note>}

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStep("choose")}>
            Back
          </Button>
          <Button onClick={commit} disabled={chosen.length === 0 || !!problem}>
            <Upload className="size-4" />
            {holdingsChosen === 0 ? "Choose a holding" : `Add ${plural(holdingsChosen, "holding", "holdings")}`}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-raised p-3.5 text-[12.5px] text-ink-2">
        <p className="mb-1.5 text-[13px] font-medium text-ink">Download your holdings from Angel One</p>
        <ol className="list-decimal space-y-1 pl-4 marker:text-ink-3">
          <li>In Angel One, download your holdings as Excel (&ldquo;Your Holding Details&rdquo;)</li>
          <li>Choose that file here. Angel One protects it with a password, which you&apos;ll be asked for</li>
        </ol>
        <p className="mt-2 text-ink-3">
          The file has what you hold and the average price, but not when you bought each share: you can set the
          dates next.
        </p>
      </div>

      {file ? (
        <div className="flex items-center gap-2.5 rounded-md border border-line bg-raised px-3 py-2 text-[12.5px]">
          <FileText className="size-4 shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
          <span className="num text-ink-3">{(file.size / 1024).toFixed(1)} KB</span>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={() => {
              setFile(null);
              setNeedsPassword(false);
              setPassword("");
              setError("");
            }}
            className="text-ink-3 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <FileDrop
          accept=".xlsx,.csv,.pdf"
          label="Choose your Angel One holdings file"
          title="Drop your holdings file here"
          hint="or click to browse · .xlsx, .csv or .pdf"
          onFiles={choose}
        />
      )}

      {needsPassword && file && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (password) read(file, password);
          }}
          className="space-y-2"
        >
          <label htmlFor="angelone-password" className="block text-[13px] text-ink-2">
            This file is protected. Enter its password to open it here; the password isn&apos;t saved.
          </label>
          <div className="flex gap-2">
            <Input
              id="angelone-password"
              type="password"
              autoComplete="off"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9"
            />
            <Button type="submit" disabled={!password}>
              Open
            </Button>
          </div>
        </form>
      )}

      <p className="text-[12px] text-ink-3">
        The file is read on this computer and not kept. DividendCase never connects to Angel One; tickers are looked
        up by ISIN in NSE&apos;s public list of securities.
      </p>

      {error && <Note icon={AlertTriangle} tone="cut">{error}</Note>}

      {!needsPassword && (
        <DialogFooter>
          <Button onClick={() => file && read(file)} disabled={!file}>
            Read file
          </Button>
        </DialogFooter>
      )}
    </div>
  );
}
