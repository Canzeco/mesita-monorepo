import * as React from "react";
import { cn } from "../cn";

// shadcn `card`, cut to the surface: the kit's SectionCard draws the header.
function Card({
  className,
  danger = false,
  ...props
}: React.ComponentProps<"section"> & { danger?: boolean }) {
  return (
    <section
      data-slot="card"
      className={cn(
        "rounded-2xl border p-4 sm:p-6",
        danger ? "border-destructive/40 bg-destructive/5" : "border-border bg-card",
        className,
      )}
      {...props}
    />
  );
}

export { Card };
