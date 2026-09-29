import { cn } from "@/lib/utils";

interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "money" | "watch";
  className?: string;
}

/** A key number with a label above it and context below. */
export function Stat({ label, value, sub, icon, tone = "default", className }: StatProps) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col gap-1.5 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5",
        tone === "watch" && "border-watch/30",
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
