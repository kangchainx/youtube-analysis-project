import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

type TypographyProps = HTMLAttributes<HTMLHeadingElement | HTMLParagraphElement>;

export function TypographyH2({
  className,
  ...props
}: TypographyProps & { children: ReactNode }) {
  return (
    <h2
      className={cn(
        "scroll-m-20 text-3xl font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TypographyLead({
  className,
  ...props
}: TypographyProps & { children: ReactNode }) {
  return (
    <p
      className={cn("text-lg text-muted-foreground", className)}
      {...props}
    />
  );
}
