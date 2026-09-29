import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sprout/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ground disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Green leads to income: add, import, save
        default:
          "bg-sprout font-semibold text-sprout-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-sprout-hi",
        destructive: "bg-cut/15 text-cut ring-1 ring-inset ring-cut/30 hover:bg-cut/25",
        outline: "border border-line bg-surface text-ink hover:border-line-strong hover:bg-raised",
        secondary: "bg-raised text-ink hover:bg-overlay",
        ghost: "text-ink-2 hover:bg-raised hover:text-ink",
        link: "text-sprout underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 rounded-md px-3 text-[13px]",
        lg: "h-11 rounded-lg px-6 text-[15px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
