import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** What a page shows before there is anything to show. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-14 text-center",
        className
      )}
    >
      {icon && (
        <div className="flex size-11 items-center justify-center rounded-xl border border-line bg-raised text-ink-2 [&_svg]:size-5">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {description && <p className="mx-auto max-w-md text-[13px] leading-relaxed text-ink-3">{description}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
