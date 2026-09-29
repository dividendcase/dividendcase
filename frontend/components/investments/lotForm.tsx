"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCY_SYMBOLS } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Currencies a lot can be bought in; "auto" means the stock's market currency. */
export const PURCHASE_CURRENCIES = Object.keys(CURRENCY_SYMBOLS).filter((c) => c !== "GBp");

export type PriceSource = "per_share" | "total" | null;

export interface LotFields {
  quantity: string;
  pricePerShare: string;
  totalCost: string;
  priceSource: PriceSource;
}

/** Price per share and total cost fill each other in, whichever the person typed last wins. */
export function updateLot(fields: LotFields, change: Partial<Pick<LotFields, "quantity" | "pricePerShare" | "totalCost">>): LotFields {
  const next = { ...fields, ...change };
  const qty = Number(next.quantity);
  if ("pricePerShare" in change) {
    next.priceSource = "per_share";
    next.totalCost = change.pricePerShare && qty > 0 ? (Number(change.pricePerShare) * qty).toFixed(2) : "";
  } else if ("totalCost" in change) {
    next.priceSource = "total";
    next.pricePerShare = change.totalCost && qty > 0 ? (Number(change.totalCost) / qty).toFixed(2) : "";
  } else if ("quantity" in change && qty > 0) {
    if (fields.priceSource === "per_share" && fields.pricePerShare) {
      next.totalCost = (Number(fields.pricePerShare) * qty).toFixed(2);
    } else if (fields.priceSource === "total" && fields.totalCost) {
      next.pricePerShare = (Number(fields.totalCost) / qty).toFixed(2);
    }
  }
  return next;
}

/** The price per share the lot resolves to, or undefined when neither price is filled in. */
export function resolvePrice(fields: LotFields): number | undefined {
  const qty = Number(fields.quantity);
  if (fields.pricePerShare) return Number(fields.pricePerShare);
  if (fields.totalCost && qty > 0) return Number(fields.totalCost) / qty;
  return undefined;
}

/** Shares, price per share and total cost, laid out as one row on wide screens. */
export function LotPriceFields({
  idPrefix,
  fields,
  onChange,
}: {
  idPrefix: string;
  fields: LotFields;
  onChange: (next: LotFields) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-qty`}>Shares</Label>
        <Input
          id={`${idPrefix}-qty`}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          placeholder="10"
          className="num"
          value={fields.quantity}
          onChange={(e) => onChange(updateLot(fields, { quantity: e.target.value }))}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-pps`}>Price per share</Label>
        <Input
          id={`${idPrefix}-pps`}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="185.50"
          className={cn("num", fields.priceSource === "total" && fields.pricePerShare && "text-ink-3")}
          value={fields.pricePerShare}
          onChange={(e) => onChange(updateLot(fields, { pricePerShare: e.target.value }))}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-total`}>Total cost</Label>
        <Input
          id={`${idPrefix}-total`}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="1855.00"
          className={cn("num", fields.priceSource === "per_share" && fields.totalCost && "text-ink-3")}
          value={fields.totalCost}
          onChange={(e) => onChange(updateLot(fields, { totalCost: e.target.value }))}
        />
      </div>
    </div>
  );
}

/** "Auto" (the stock's market currency) or a specific purchase currency. */
export function PurchaseCurrencySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (currency: string) => void;
}) {
  return (
    <Select value={value || "auto"} onValueChange={(v) => onChange(v === "auto" ? "" : v)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="auto">Auto (market currency)</SelectItem>
        {PURCHASE_CURRENCIES.map((code) => (
          <SelectItem key={code} value={code}>
            <span className="num">{code}</span>
            <span className="ml-2 text-ink-3">{CURRENCY_SYMBOLS[code].trim()}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
