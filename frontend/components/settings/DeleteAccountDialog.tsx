"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount } from "@/lib/api/backend";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: Props) {
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteAccount();
      // Reload so every view starts from the now-empty local database
      window.location.href = "/dashboard/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete your data");
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!loading) {
      setConfirmation("");
      setError(null);
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl border border-cut/30 bg-cut/10 text-cut max-sm:mx-auto">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle>Delete all my data?</DialogTitle>
          <DialogDescription>
            This permanently deletes your portfolios, holdings, watchlists and settings from this computer. Downloaded
            market data is kept. Export your data first if you want a copy.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmation === "DELETE" && !loading) handleDelete();
          }}
        >
          <Label htmlFor="confirm-delete">
            Type <span className="num font-semibold text-ink">DELETE</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            autoComplete="off"
            spellCheck={false}
            className="num"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="DELETE"
            disabled={loading}
          />
          {error && (
            <p role="alert" className="text-[13px] text-cut">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={confirmation !== "DELETE" || loading}>
            <Trash2 className="size-4" />
            {loading ? "Deleting…" : "Delete all my data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
