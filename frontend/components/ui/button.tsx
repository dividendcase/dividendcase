import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Capsules, like the glass controls they sit beside; a press gives a little, then springs back
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out-soft active:scale-[0.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sprout/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ground disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Green leads to income: add, import, save. Tinted glass: a lit top edge over the green
        default:
          "border-transparent bg-sprout bg-[linear-gradient(180deg,rgb(255_255_255/0.24),rgb(255_255_255/0)_58%)] font-semibold text-sprout-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.4),inset_0_-1px_0_rgb(0_0_0/0.18),0_6px_18px_-8px_rgb(0_0_0/0.7)] hover:bg-sprout-hi",
        destructive: "border-transparent bg-cut/15 text-cut ring-1 ring-inset ring-cut/30 hover:bg-cut/25",
        outline: "glass-control text-ink hover:border-white/[0.13] hover:bg-white/[0.08]",
        secondary: "glass-control text-ink hover:border-white/[0.13] hover:bg-white/[0.08]",
        ghost: "border-transparent text-ink-2 hover:bg-white/[0.06] hover:text-ink",
        link: "border-transparent text-sprout underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3.5 text-[13px]",
        lg: "h-11 px-6 text-[15px]",
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
