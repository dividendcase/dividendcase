import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Small line above the title, such as the page's section */
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** The title block at the top of every page, with actions on the right. */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[26px]">{title}</h1>
        {description && <p className="max-w-2xl text-[13.5px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
