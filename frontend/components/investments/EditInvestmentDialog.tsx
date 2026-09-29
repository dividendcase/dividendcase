"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TickerBadge } from "@/components/ui/ticker-badge";
import type { InvestmentItem } from "@/lib/types";
import { LotPriceFields, PurchaseCurrencySelect, resolvePrice, type LotFields } from "./lotForm";

interface EditInvestmentDialogProps {
  investment: InvestmentItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: number, updates: { quantity?: number; purchase_price?: number; purchase_date?: string; purchase_currency?: string }) => Promise<void>;
}

export function EditInvestmentDialog({ investment, open, onOpenChange, onSave }: EditInvestmentDialogProps) {
  const [lot, setLot] = useState<LotFields>(() => ({
    quantity: String(investment.quantity),
    pricePerShare: investment.purchase_price != null ? String(investment.purchase_price) : "",
    totalCost:
      investment.purchase_price != null
        ? String(Number((investment.purchase_price * investment.quantity).toFixed(2)))
        : "",
    priceSource: investment.purchase_price != null ? "per_share" : null,
  }));
  const [date, setDate] = useState(investment.purchase_date);
  const [currency, setCurrency] = useState(investment.purchase_currency ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    const qty = Number(lot.quantity);
    if (!qty || qty <= 0) {
      setError("Shares must be more than 0.");
      return;
    }
    const resolvedPrice = resolvePrice(lot);

    setError("");
    setSaving(true);
    try {
      const updates: Record<string, number | string> = {};
      if (qty !== investment.quantity) updates.quantity = qty;
      if (resolvedPrice != null && resolvedPrice !== investment.purchase_price) updates.purchase_price = resolvedPrice;
      if (date !== investment.purchase_date) updates.purchase_date = date;
      if (currency !== (investment.purchase_currency ?? "")) updates.purchase_currency = currency;

      if (Object.keys(updates).length === 0) {
        onOpenChange(false);
        return;
      }

      await onSave(investment.id, updates);
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn't save the lot";
      setError(msg.includes("409") ? "You already have a lot of this stock bought on that date." : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <TickerBadge ticker={investment.ticker_symbol} />
            <span>
              Edit lot <span className="num text-ink-2">{investment.ticker_symbol}</span>
            </span>
          </DialogTitle>
          <DialogDescription>Change the details of this purchase.</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <LotPriceFields idPrefix="edit" fields={lot} onChange={setLot} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-date">Purchase date</Label>
              <Input id="edit-date" type="date" className="num" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-currency">Paid in</Label>
              <PurchaseCurrencySelect id="edit-currency" value={currency} onChange={setCurrency} />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-cut/30 bg-cut/10 px-3 py-2 text-[13px] text-cut">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
