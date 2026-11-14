import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../cn";

// shadcn `badge`, edited to the admin tones (no primary): the kit's Chip.
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 type-meta font-semibold tracking-wide whitespace-nowrap uppercase",
  {
    variants: {
      tone: {
        neutral: "border-border text-muted-foreground bg-card",
        success: "bg-success-subtle text-success border-transparent",
        warning: "bg-warning-subtle text-warning border-transparent",
        danger: "bg-destructive/10 text-destructive border-transparent",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
