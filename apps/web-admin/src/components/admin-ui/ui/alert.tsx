import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../cn";

// shadcn `alert`, edited to the admin tones: the kit's Notice.
const alertVariants = cva(
  "flex w-full items-start gap-2 rounded-xl border p-3 text-sm [&>svg]:mt-0.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        error: "border-destructive/40 bg-destructive/5 text-destructive",
        warning: "bg-warning-subtle text-warning border-transparent",
        info: "border-border bg-muted/50 text-muted-foreground",
        success: "bg-success-subtle text-success border-transparent",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

function Alert({
  className,
  tone,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" className={cn(alertVariants({ tone }), className)} {...props} />;
}

export { Alert, alertVariants };
