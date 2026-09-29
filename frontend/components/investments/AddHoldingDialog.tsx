"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TickerBadge } from "@/components/ui/ticker-badge";
import { addInvestment } from "@/lib/api/backend";
import type { Portfolio, StockSearchResult } from "@/lib/types";
import { StockSearchField } from "./StockSearchField";
import { LotPriceFields, PurchaseCurrencySelect, resolvePrice, type LotFields } from "./lotForm";

interface AddHoldingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolios: Portfolio[];
  /** The portfolio being viewed; on the all-portfolios page the person picks one */
  defaultPortfolioId?: number;
  onAdded: () => void;
}

const EMPTY_LOT: LotFields = { quantity: "", pricePerShare: "", totalCost: "", priceSource: null };

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AddHoldingDialog({ open, onOpenChange, portfolios, defaultPortfolioId, onAdded }: AddHoldingDialogProps) {
  const [stock, setStock] = useState<StockSearchResult | null>(null);
  const [searchText, setSearchText] = useState("");
  const [portfolioId, setPortfolioId] = useState<number | undefined>(defaultPortfolioId);
  const [date, setDate] = useState(today());
  const [lot, setLot] = useState<LotFields>(EMPTY_LOT);
  const [currency, setCurrency] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addedCount, setAddedCount] = useState(0);

  // Start fresh each time the dialog opens
  useEffect(() => {
    if (!open) return;
    setStock(null);
    setSearchText("");
    setPortfolioId(defaultPortfolioId ?? portfolios[0]?.id);
    setDate(today());
    setLot(EMPTY_LOT);
    setCurrency("");
    setError("");
    setAddedCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (keepOpen: boolean) => {
    const qty = Number(lot.quantity);
    if (!stock) return setError("Pick a stock first.");
    if (!date) return setError("Enter the purchase date.");
    if (!qty || qty <= 0) return setError("Enter how many shares you bought.");
    const price = resolvePrice(lot);
    if (!price || price <= 0) return setError("Enter the price per share or the total cost.");

    setError("");
    setSaving(true);
    try {
      await addInvestment({
        ticker: stock.symbol,
        purchase_date: date,
        quantity: qty,
        purchase_price: price,
        purchase_currency: currency || undefined,
        portfolio_id: portfolioId,
      });
      onAdded();
      if (keepOpen) {
        setAddedCount((n) => n + 1);
        setStock(null);
        setSearchText("");
        setLot(EMPTY_LOT);
      } else {
        onOpenChange(false);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn't add the holding";
      setError(msg.includes("409") ? `${stock.symbol} bought on ${date} is already in your holdings.` : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add holding</DialogTitle>
          <DialogDescription>
            One purchase (a lot). Buy the same stock again later? Add another lot with its own date and price.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="add-stock">Stock</Label>
            {stock ? (
              <div className="flex h-9 items-center gap-2.5 rounded-md border border-line bg-well pl-1.5 pr-1">
                <TickerBadge ticker={stock.symbol} />
                <span className="num text-[13px] font-medium text-ink">{stock.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-3">{stock.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Choose another stock"
                  onClick={() => {
                    setStock(null);
                    setSearchText("");
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <StockSearchField
                id="add-stock"
                autoFocus
                value={searchText}
                onValueChange={setSearchText}
                onSelect={setStock}
              />
            )}
          </div>

          <div className={portfolios.length > 1 ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "grid gap-3"}>
            {portfolios.length > 1 && (
              <div className="grid gap-1.5">
                <Label htmlFor="add-portfolio">Portfolio</Label>
                <Select
                  value={portfolioId != null ? String(portfolioId) : undefined}
                  onValueChange={(v) => setPortfolioId(Number(v))}
                >
                  <SelectTrigger id="add-portfolio">
                    <SelectValue placeholder="Choose a portfolio" />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolios.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="add-date">Purchase date</Label>
              <Input
                id="add-date"
                type="date"
                max={today()}
                className="num"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <LotPriceFields idPrefix="add" fields={lot} onChange={setLot} />

          <div className="grid gap-1.5 sm:max-w-[50%]">
            <Label htmlFor="add-currency">Paid in</Label>
            <PurchaseCurrencySelect id="add-currency" value={currency} onChange={setCurrency} />
          </div>

          <p className="text-[12.5px] leading-relaxed text-ink-3">
            Fill in the price per share or the total cost; the other is worked out. If you paid in a different
            currency from the stock&apos;s market, choose it so the cost is labelled correctly.
          </p>

          {error && (
            <p role="alert" className="rounded-md border border-cut/30 bg-cut/10 px-3 py-2 text-[13px] text-cut">
              {error}
            </p>
          )}
          {addedCount > 0 && !error && (
            <p className="text-[12.5px] text-ink-2">
              <span className="num text-money">{addedCount}</span> added. Add another, or close when you&apos;re done.
            </p>
          )}

          <DialogFooter className="gap-2 sm:items-center">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              {addedCount > 0 ? "Done" : "Cancel"}
            </Button>
            <Button type="button" variant="outline" onClick={() => submit(true)} disabled={saving || !stock}>
              Add and add another
            </Button>
            <Button type="submit" disabled={saving || !stock}>
              <Plus className="size-4" />
              {saving ? "Adding…" : "Add holding"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
