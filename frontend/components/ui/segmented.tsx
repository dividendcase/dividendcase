"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: React.ReactNode; title?: string }[];
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

/**
 * A row of mutually exclusive options, such as 3Y / 5Y / 10Y. The chosen one sits under a glass
 * thumb that slides across to the next choice, so the change is easy to follow.
 */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  size = "sm",
  className,
  ...rest
}: SegmentedProps<T>) {
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const activeIndex = options.findIndex((o) => o.value === value);

  // Measure the chosen button; again whenever the track resizes (fonts load, labels change)
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const button = el.querySelectorAll<HTMLButtonElement>("[role=radio]")[activeIndex];
      setThumb(button ? { left: button.offsetLeft, width: button.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeIndex, options.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step || options.length === 0) return;
    e.preventDefault();
    const next = (Math.max(activeIndex, 0) + step + options.length) % options.length;
    onChange(options[next].value);
    track.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  };

  return (
    <div
      ref={track}
      role="radiogroup"
      aria-label={rest["aria-label"]}
      onKeyDown={onKeyDown}
      className={cn("glass-well relative inline-flex shrink-0 items-center rounded-full border p-0.5", className)}
    >
      {thumb && (
        <span
          aria-hidden="true"
          className="glass-control absolute inset-y-0.5 left-0 rounded-full border transition-[transform,width] duration-300 ease-out-soft"
          style={{ transform: `translateX(${thumb.left}px)`, width: thumb.width }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (activeIndex < 0 && o === options[0]) ? 0 : -1}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 rounded-full font-medium transition-colors duration-200",
              size === "sm" ? "px-2.5 py-1 text-[12.5px]" : "px-3.5 py-1.5 text-[13px]",
              active ? "text-ink" : "text-ink-3 hover:text-ink-2"
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
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-[color,background-color,border-color,transform] duration-200 ease-out-soft active:scale-[0.96]",
        active
          ? "border-sprout/35 bg-sprout/[0.13] text-sprout-hi shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
          : "border-white/[0.07] bg-white/[0.025] text-ink-2 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-ink",
        className
      )}
    >
      {children}
    </button>
  );
}
