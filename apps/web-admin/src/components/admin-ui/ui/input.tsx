import * as React from "react";
import { cn } from "../cn";
import { FOCUS_RING_CLASS } from "../classes";

/** The field look: 44px below sm (touch), 40px above; 16px text below sm (iOS zoom). */
export const INPUT_CLASS = cn(
  "border-border bg-background placeholder:text-muted-foreground/60 h-11 w-full min-w-0 rounded-xl border px-3 text-base transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm",
  FOCUS_RING_CLASS,
);

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(INPUT_CLASS, className)} {...props} />;
}

export { Input };
