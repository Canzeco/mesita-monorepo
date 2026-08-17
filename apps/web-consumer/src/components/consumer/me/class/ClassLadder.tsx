"use client";

import { Lock } from "lucide-react";

import {
  CLASSES,
  CLASS_MARK_ICON,
  classBadgeClass,
} from "@/lib/consumer-data";
import { CLASS_TEXT } from "@/lib/class-styles";
import { useConsumerClass } from "@/lib/class-context";
import { cn } from "@/lib/utils";

// The class ladder, stated ONCE (decision: Pato, MESITA-1124).
//
// Replaces three components that each drew the same four classes: the rail of
// chips, the big "You" card, and four full climb cards. A guest scrolled past
// Bronze three times before reaching anything they could act on.
//
// THREE RULES HOLD THIS SCREEN TOGETHER:
//
// 1. ONE SHAPE. Every rung wears the same pyramid — the class mark. The old
//    set (medal / award / trophy / gem) made the reader learn four symbols to
//    read one ladder, and no symbol carried information the order didn't.
// 2. COLOUR MEANS CLASS, AND NOTHING ELSE. The only colour here is a metal.
//    No emerald "unlocked" ticks, no pink CTA, no amber demo chip — when
//    everything else is neutral, the one coloured thing is unambiguous.
// 3. NO LETTERS FOR THE LADDER. The discount scale used to be spelled out per
//    rung (LOW / HIGH / EXTRA / MAX) on a four-bar meter. The rows are already
//    in ascending order and already carry the metal, so the words restated
//    what position and colour had said — cognitive load for nothing. The
//    header states once that rewards climb; the ladder shows how far.

export function ClassLadder() {
  const { key, doors } = useConsumerClass();

  return (
    <ol className="flex flex-col gap-2">
      {CLASSES.map((c) => {
        const current = key === c.id;
        // Bronze is a door every account holds. The other three resolve to the
        // two v2 doors: reach carries Silver AND Gold (one Instagram claim,
        // banded by follower count), invitation carries Diamond.
        const unlocked =
          current ||
          c.id === "bronze" ||
          (c.id === "diamond" ? doors.invitation : doors.reach);

        return (
          <li
            key={c.id}
            aria-current={current ? "true" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-2xl p-3.5",
              current
                ? cn("shadow-sm", classBadgeClass(c.id))
                : "border-border bg-card border",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                current ? "bg-white/20" : "bg-muted",
              )}
            >
              <CLASS_MARK_ICON
                className={cn(
                  "h-[18px] w-[18px]",
                  // Off the current row the metal survives as INK — the one
                  // place colour is allowed, because it IS the class.
                  current
                    ? ""
                    : unlocked
                      ? CLASS_TEXT[c.id]
                      : "text-muted-foreground/50",
                )}
              />
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "font-display text-[15px] leading-tight font-bold tracking-tight",
                  !current && !unlocked && "text-muted-foreground",
                )}
              >
                {c.label}
              </p>
              <p
                className={cn(
                  "mt-0.5 flex items-center gap-1 text-[12px] leading-snug",
                  current ? "opacity-90" : "text-muted-foreground",
                )}
              >
                {!current && !unlocked && (
                  <Lock className="h-2.5 w-2.5 shrink-0" aria-hidden />
                )}
                <span className="truncate">{c.req}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
