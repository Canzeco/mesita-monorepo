"use client";

import { Check, MapPin, QrCode, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";

// The four-step journey rail — Place → Reward → Do it → Show QR.
//
// ONE component, deliberately. It used to be two: a static four-step pitch
// painted on the Rewards page while the wizard sheet separately claimed
// "Step 1 · 2", so a single flow advertised two different step counts in two
// different containers (MESITA-1015 collapsed them into the sheet).
//
// It lives here rather than inside TicketWizard because the wallet page needs
// it back as a persistent header — but ONLY as a reflection of real ticket
// state, never as a static pitch. Both callers pass a `current` derived from
// something true, and both render this exact markup, so the two surfaces can't
// drift into disagreeing again. If you need the rail somewhere new, import it;
// do not re-implement it.
export const JOURNEY = [
  { n: 1, label: "Place", icon: MapPin },
  { n: 2, label: "Reward", icon: Sparkles },
  { n: 3, label: "Do it", icon: Star },
  { n: 4, label: "Show QR", icon: QrCode },
] as const;

export function JourneyRail({ current }: { current: number }) {
  return (
    <ol className="relative flex items-start" aria-label="Ticket steps">
      <span
        aria-hidden="true"
        className="bg-border absolute top-[13px] right-[12.5%] left-[12.5%] h-px"
      />
      {JOURNEY.map(({ n, label, icon: Icon }) => {
        const done = n < current;
        const now = n === current;
        return (
          <li
            key={n}
            className="relative z-[1] flex w-0 flex-1 flex-col items-center gap-1"
            aria-current={now ? "step" : undefined}
          >
            <span
              className={cn(
                "grid size-[26px] place-items-center rounded-full border transition",
                now
                  ? "bg-pink-gradient border-transparent text-white"
                  : done
                    ? "border-secondary/30 bg-secondary/10 text-secondary"
                    : "border-border bg-background text-muted-foreground/50",
              )}
            >
              {done ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : (
                <Icon className="size-3.5" strokeWidth={2.25} />
              )}
            </span>
            <span
              className={cn(
                "text-center text-[9.5px] leading-tight font-semibold",
                now ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
