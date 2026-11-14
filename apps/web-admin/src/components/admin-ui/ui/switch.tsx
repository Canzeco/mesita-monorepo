"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "../cn";
import { FOCUS_RING_CLASS, TOUCH_TARGET_CLASS } from "../classes";

// shadcn `switch`, edited to the admin skin: checked = ink, 28×48 track.
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "data-[state=checked]:bg-foreground data-[state=unchecked]:bg-muted inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
        FOCUS_RING_CLASS,
        TOUCH_TARGET_CLASS,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-background pointer-events-none block h-5 w-5 rounded-full transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-1"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
