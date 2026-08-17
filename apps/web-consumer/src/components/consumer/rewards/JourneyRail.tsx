"use client";

import { cn } from "@/lib/utils";
import {
  TICKET_STEPS,
  stepIndex,
  type TicketStepId,
} from "@/lib/ticket-journey";

// THE TICKET's step rail, v4 (MESITA-1091) — SEVEN chips:
// Bill · Reward · Task · QR · Pay · Validate · Results.
//
// The chip design comes from the Lovable mock: a 3px progress bar over a
// tiny label, seven EQUAL columns. Seven inline icon-bubbles cannot fit
// 448px, and seven labels at ~62px each only fit because the bar carries the
// done-state instead of a glyph. At large accessibility text the grid
// degrades to a scroller (auto-cols-fr on a w-max min-w-full track — the
// same equal-fraction rule the Inbox and Home rows use) instead of clipping
// "Validate".
//
// The rail reflects REAL ticket state and one staff-driven state: `amberId`
// paints the step a send-back returned the guest to (D3 — amber, never red,
// and the word "rejected" appears nowhere). Unreachable chips stay visible
// but inert: a step that vanishes stops telling you the journey has seven.
export function JourneyRail({
  currentId,
  amberId = null,
  onSelect,
  isReachable,
}: {
  currentId: TicketStepId;
  /** The step an outstanding fix returned the guest to (D3). */
  amberId?: TicketStepId | null;
  onSelect?: (id: TicketStepId) => void;
  isReachable?: (id: TicketStepId) => boolean;
}) {
  const currentIdx = stepIndex(currentId);
  return (
    <div className="scrollbar-hide overflow-x-auto" aria-label="Ticket steps">
      <ol className="grid w-max min-w-full auto-cols-fr grid-flow-col gap-1">
        {TICKET_STEPS.map(({ id, label }) => {
          const idx = stepIndex(id);
          const done = idx <= currentIdx;
          const current = id === currentId;
          const amber = id === amberId;
          const tappable =
            Boolean(onSelect) && (isReachable?.(id) ?? true) && !current;
          const body = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "h-[3px] w-full rounded-full transition-colors",
                  amber
                    ? "bg-amber-500"
                    : done
                      ? "bg-pink-gradient"
                      : "bg-border",
                )}
              />
              <span
                className={cn(
                  "truncate text-[9px] leading-none",
                  amber
                    ? "font-bold text-amber-800"
                    : current
                      ? "text-foreground font-bold"
                      : done
                        ? "text-primary font-semibold"
                        : "text-muted-foreground font-medium",
                )}
              >
                {label}
              </span>
            </>
          );
          const shell = cn(
            "flex min-h-[44px] w-full min-w-[52px] flex-col items-start justify-center gap-1.5 rounded-xl border px-1.5 text-left transition",
            amber
              ? "border-amber-500/40 bg-amber-500/10"
              : current
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-card",
            !tappable && !current && "opacity-55",
          );
          return (
            <li key={id} className="min-w-0">
              {tappable ? (
                <button
                  type="button"
                  onClick={() => onSelect!(id)}
                  className={shell}
                >
                  {body}
                </button>
              ) : (
                <div
                  aria-current={current ? "step" : undefined}
                  className={shell}
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
