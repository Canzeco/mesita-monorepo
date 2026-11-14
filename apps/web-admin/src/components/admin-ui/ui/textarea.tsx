import * as React from "react";
import { cn } from "../cn";
import { FOCUS_RING_CLASS } from "../classes";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-border bg-background placeholder:text-muted-foreground/60 min-h-24 w-full rounded-xl border px-3 py-2 text-base leading-relaxed transition disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        FOCUS_RING_CLASS,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
