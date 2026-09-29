"use client";

import { useEffect, useState } from "react";
import { FolderX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Portfolio } from "@/lib/types";

export type DeletePortfolioChoice = { action: "delete_all" } | { action: "move"; targetId: number };

interface DeletePortfolioDialogProps {
  portfolio: Portfolio | null;
  portfolios: Portfolio[];
  /** Lots in the portfolio, to say what will happen to them */
  lotCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (choice: DeletePortfolioChoice) => Promise<void>;
}

export function DeletePortfolioDialog({ portfolio, portfolios, lotCount, onOpenChange, onConfirm }: DeletePortfolioDialogProps) {
  const others = portfolios.filter((p) => p.id !== portfolio?.id);
  const [action, setAction] = useState<"delete_all" | "move">("delete_all");
  const [targetId, setTargetId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!portfolio) return;
    setAction(lotCount > 0 && others.length > 0 ? "move" : "delete_all");
    setTargetId(others[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio?.id]);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(action === "move" && targetId != null ? { action: "move", targetId } : { action: "delete_all" });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const option = (value: "delete_all" | "move", title: string, description: string, extra?: React.ReactNode) => (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        action === value ? "border-line-strong bg-raised" : "border-line hover:bg-raised/50"
      )}
    >
      <input
        type="radio"
        name="delete-portfolio-action"
        checked={action === value}
        onChange={() => setAction(value)}
        className="mt-0.5 accent-sprout"
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[13.5px] font-medium text-ink">{title}</p>
        <p className="text-[12.5px] text-ink-3">{description}</p>
        {extra}
      </div>
    </label>
  );

  return (
    <Dialog open={portfolio != null} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {portfolio ? `“${portfolio.name}”` : "portfolio"}</DialogTitle>
          <DialogDescription>
            {lotCount > 0 ? (
              <>
                It holds <span className="num text-ink-2">{lotCount}</span> lot{lotCount === 1 ? "" : "s"}. Choose what
                happens to them.
              </>
            ) : (
              "This portfolio is empty."
            )}
          </DialogDescription>
        </DialogHeader>

        {lotCount > 0 && (
          <div className="space-y-2.5">
            {others.length > 0 &&
              option(
                "move",
                "Move the holdings, then delete",
                "Keep every lot by moving it to another portfolio.",
                action === "move" && (
                  <div className="pt-2">
                    <Select value={targetId != null ? String(targetId) : undefined} onValueChange={(v) => setTargetId(Number(v))}>
                      <SelectTrigger className="h-8" aria-label="Move holdings to">
                        <SelectValue placeholder="Choose a portfolio" />
                      </SelectTrigger>
                      <SelectContent>
                        {others.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              )}
            {option("delete_all", "Delete the holdings too", "Removes the portfolio and every lot in it from this computer.")}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy || (action === "move" && targetId == null)}>
            <FolderX className="size-4" />
            {busy ? "Deleting…" : "Delete portfolio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
