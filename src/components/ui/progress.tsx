import * as React from "react";
import { cn } from "@/lib/utils";

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number | null;
  max?: number;
  indeterminate?: boolean;
};

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    { className, value = null, max = 100, indeterminate, ...props },
    ref,
  ) => {
    const isIndeterminate =
      indeterminate || value === null || value === undefined;
    const clampedValue = Math.min(Math.max(value ?? 0, 0), max);
    const percentage = (clampedValue / max) * 100;

    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-muted",
          className,
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={isIndeterminate ? undefined : clampedValue}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full bg-primary transition-transform duration-500 ease-out",
            isIndeterminate && "animate-pulse",
          )}
          style={{
            transform: isIndeterminate
              ? "translateX(-50%)"
              : `translateX(${percentage - 100}%)`,
          }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

