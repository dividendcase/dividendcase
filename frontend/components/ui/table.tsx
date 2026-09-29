import * as React from "react";
import { cn } from "@/lib/utils";

/** Data tables: quiet uppercase headers, hairline rows, numbers right-aligned in mono. */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-[13px]", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("", className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("", className)} {...props} />;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-t border-line transition-colors first:border-t-0 hover:bg-raised/40", className)} {...props} />;
}

export function TH({ className, numeric, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-line px-3 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3 first:pl-4 last:pr-4",
        numeric ? "text-right" : "text-left",
        className
      )}
      {...props}
    />
  );
}

export function TD({ className, numeric, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 align-middle text-ink-2 first:pl-4 last:pr-4",
        numeric && "num text-right text-ink",
        className
      )}
      {...props}
    />
  );
}
