"use client";

import { useState } from "react";
import { ArrowUpCircle, Check, Copy, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppInfo } from "@/lib/hooks/useAppInfo";

/** Shown in the sidebar when PyPI has a newer version than the one running. */
export function UpdateNotice() {
  const { info } = useAppInfo();
  const [copied, setCopied] = useState(false);
  if (!info?.update_available || !info.latest_version) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.upgrade_command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the command is still selectable
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="mx-3 mb-2 flex items-center gap-2.5 rounded-xl border border-sprout/30 bg-sprout/[0.07] px-3 py-2.5 text-left transition-colors hover:border-sprout/50">
          <ArrowUpCircle className="size-4 shrink-0 text-sprout" />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium text-ink">
              Version <span className="num">{info.latest_version}</span> is out
            </span>
            <span className="block text-[11.5px] text-ink-3">How to update</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-80 space-y-3">
        <p className="text-[13px] font-medium text-ink">
          Update from <span className="num">{info.version}</span> to <span className="num">{info.latest_version}</span>
        </p>
        <ol className="space-y-2 text-[12.5px] text-ink-2">
          <li>1. Stop DividendCase (close its terminal window, or press Ctrl+C there).</li>
          <li>
            2. Run:
            <div className="mt-1.5 flex items-center gap-2 rounded-md border border-line bg-well py-1 pl-3 pr-1">
              <code className="num min-w-0 flex-1 select-all text-[12px] text-ink">{info.upgrade_command}</code>
              <button
                onClick={copy}
                aria-label="Copy command"
                className="rounded p-1.5 text-ink-3 transition-colors hover:bg-raised hover:text-ink"
              >
                {copied ? <Check className="size-3.5 text-sprout" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          </li>
          <li>3. Start it again with <code className="num text-ink">dividendcase</code>. Your data is backed up before anything changes.</li>
        </ol>
        <a
          href={info.releases_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink"
        >
          <ExternalLink className="size-3.5" />
          What&apos;s new
        </a>
      </PopoverContent>
    </Popover>
  );
}
