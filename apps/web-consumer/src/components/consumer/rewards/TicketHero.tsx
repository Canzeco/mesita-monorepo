import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

// THE TICKET's hero panel (MESITA-1350). Owns the named corner
// (`rounded-panel` → `--radius-panel`) plus the glow / overflow / white-ink
// shell. Fill (class gradient vs pink) and padding stay at the call site —
// those are three jobs, not three radii.
//
// Do not pin the integer 24. Chrome stays on the 14px-ceiling scale.
// Nested QR chrome is rounded-2xl on purpose (the nest, not a second hero).

export const TICKET_HERO_RADIUS_CLASS = "rounded-panel";

const TICKET_HERO_GLOW = {
  sm: "shadow-glow-sm",
  full: "shadow-glow",
} as const;

export function TicketHero({
  className,
  glow = "sm",
  ...props
}: ComponentPropsWithoutRef<"section"> & {
  glow?: keyof typeof TICKET_HERO_GLOW;
}) {
  return (
    <section
      data-slot="ticket-hero"
      className={cn(
        TICKET_HERO_RADIUS_CLASS,
        TICKET_HERO_GLOW[glow],
        "shrink-0 overflow-hidden text-white",
        className,
      )}
      {...props}
    />
  );
}
