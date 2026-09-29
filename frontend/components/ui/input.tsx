import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-line bg-well px-3 py-2 text-sm text-ink transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-ink-3 hover:border-line-strong focus-visible:outline-hidden focus-visible:border-sprout/60 focus-visible:ring-2 focus-visible:ring-sprout/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
