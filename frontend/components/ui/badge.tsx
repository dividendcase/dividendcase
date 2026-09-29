import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-4 whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "bg-sprout/15 text-sprout-hi",
        secondary: "bg-raised text-ink-2",
        destructive: "bg-cut/15 text-cut",
        outline: "ring-1 ring-inset ring-line text-ink-2",
        // Money and dividend health
        green: "bg-sprout/15 text-sprout-hi",
        // Risk: something to keep an eye on
        amber: "bg-watch/15 text-watch",
        // Keeper (AI) only
        keeper: "bg-dial-hi/15 text-dial-hi",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
