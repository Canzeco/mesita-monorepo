"use client";

import { Check, PartyPopper, QrCode, Sparkles, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// The TICKET's step rail — Reward → Do it → Show QR → Results (Pato,
// 2026-08-11: "the modal has multiple steps: 1. select rewards/tasks, 2. do
// tasks, 3. show qr, 4. results page").
//
// ONE component, deliberately. It used to be two: a static four-step pitch
// painted on the Rewards page while the wizard sheet separately claimed
// "Step 1 · 2", so a single flow advertised two different step counts in two
// different containers (MESITA-1015 collapsed them into the sheet).
//
// This rail belongs to THE TICKET and reflects real ticket state — never a
// static pitch. The four steps painted on /rewards are a different object:
// they are the wallet's masthead (Pato, 2026-08-10, "those are the header"),
// they describe the PROGRAM and start at "Pick place", and they never move.
// This one starts where that one ends — the place is already picked by the
// time a ticket exists — and it tracks one ticket to its result.
export type JourneyStep = {
  n: number;
  label: string;
  icon: LucideIcon;
};

export const TICKET_JOURNEY: readonly JourneyStep[] = [
  { n: 1, label: "Reward", icon: Sparkles },
  { n: 2, label: "Do it", icon: Star },
  { n: 3, label: "Show QR", icon: QrCode },
  { n: 4, label: "Results", icon: PartyPopper },
];

export function JourneyRail({
  steps = TICKET_JOURNEY,
  current,
  onSelect,
  isReachable,
}: {
  steps?: readonly JourneyStep[];
  current: number;
  /** Omit to render the rail as a read-only indicator. */
  onSelect?: (n: number) => void;
  /** Which steps accept a tap. Unreachable nodes stay inert, not hidden —
   *  a step that vanishes stops telling you the flow has four of them. */
  isReachable?: (n: number) => boolean;
}) {
  return (
    <ol className="relative flex items-start" aria-label="Ticket steps">
      <span
        aria-hidden="true"
        className="bg-border absolute top-[13px] right-[12.5%] left-[12.5%] h-px"
      />
      {steps.map(({ n, label, icon: Icon }) => {
        const done = n < current;
        const now = n === current;
        const tappable = Boolean(onSelect) && (isReachable?.(n) ?? true) && !now;
        const node = (
          <>
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
          </>
        );
        return (
          <li
            key={n}
            className="relative z-[1] flex w-0 flex-1 flex-col items-center"
            aria-current={now ? "step" : undefined}
          >
            {tappable ? (
              <button
                type="button"
                onClick={() => onSelect?.(n)}
                // Vertical slop keeps a ≥44px hit target around a 26px node
                // without letting the rail grow taller.
                className="-my-2 flex flex-col items-center gap-1 py-2 transition active:scale-95"
              >
                {node}
              </button>
            ) : (
              <span className="flex flex-col items-center gap-1">{node}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
