"use client";

import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: React.ReactNode; title?: string }[];
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

/** A row of mutually exclusive options, such as 3Y / 5Y / 10Y. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  size = "sm",
  className,
  ...rest
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest["aria-label"]}
      className={cn("inline-flex shrink-0 items-center rounded-lg border border-line bg-well p-0.5", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[12.5px]" : "px-3 py-1.5 text-[13px]",
              active ? "bg-raised text-ink shadow-[0_1px_0_rgb(255_255_255/0.04)_inset]" : "text-ink-3 hover:text-ink-2"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A toggleable filter chip. */
export function Chip({
  active,
  onClick,
  children,
  title,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors",
        active
          ? "border-sprout/40 bg-sprout/12 text-sprout-hi"
          : "border-line bg-transparent text-ink-2 hover:border-line-strong hover:text-ink",
        className
      )}
    >
      {children}
    </button>
  );
}
