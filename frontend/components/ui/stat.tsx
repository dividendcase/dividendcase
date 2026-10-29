import { cn } from "@/lib/utils";

interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "money" | "watch";
  /** Inside a StatGroup: no panel of its own */
  bare?: boolean;
  className?: string;
}

/** A key number with a label above it and context below. */
export function Stat({ label, value, sub, icon, tone = "default", bare = false, className }: StatProps) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col gap-1.5 p-4 sm:p-5",
        bare ? "-ml-px -mt-px border-l border-t border-white/[0.06]" : "glass-panel rounded-xl border",
        tone === "watch" && !bare && "border-watch/30",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow truncate">{label}</p>
        {icon && <span className="text-ink-3 [&_svg]:size-4">{icon}</span>}
      </div>
      <div
        className={cn(
          "num truncate text-[26px] font-medium leading-none tracking-[-0.03em] sm:text-[28px]",
          tone === "money" ? "text-money" : tone === "watch" ? "text-watch" : "text-ink"
        )}
      >
        {value}
      </div>
      {sub && <div className="truncate text-[12.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

/**
 * Several Stats on one glass panel, split by hairlines, so a row of key numbers reads as one
 * thing. Pass the grid columns, e.g. "grid-cols-2 lg:grid-cols-4", and give each Stat `bare`.
 */
export function StatGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("glass-panel grid overflow-hidden rounded-xl border", className)}>{children}</div>;
}
