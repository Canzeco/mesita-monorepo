import * as React from "react";
import { cn } from "../cn";
import { FOCUS_RING_CLASS } from "../classes";

/** The field frame: 44px below sm (touch), 40px above; 16px text below sm (iOS zoom). No width or padding. */
export const INPUT_FRAME_CLASS = cn(
  "border-border bg-background placeholder:text-muted-foreground/60 h-11 min-w-0 rounded-xl border text-base transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm",
  FOCUS_RING_CLASS,
);

function Input({
  className,
  type,
  leading = false,
  ...props
}: React.ComponentProps<"input"> & {
  /** Room for an adornment inside the left edge. */
  leading?: boolean;
}) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(INPUT_FRAME_CLASS, "w-full", leading ? "pr-3 pl-9" : "px-3", className)}
      {...props}
    />
  );
}

export { Input };
