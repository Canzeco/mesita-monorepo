"use client";

import { Lock } from "lucide-react";

import { CLASSES, CLASS_MARK_ICON, classBadgeClass } from "@/lib/consumer-data";
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
// 2. COLOUR MEANS CLASS, AND NOTHING ELSE, and it is carried by a FILL — the
//    current row's card, and every other row's mark tile. No emerald
//    "unlocked" ticks, no pink CTA, no amber demo chip — when everything else
//    is neutral, the one coloured thing is unambiguous.
// 3. NO LETTERS FOR THE LADDER. The discount scale used to be spelled out per
//    rung (LOW / HIGH / EXTRA / MAX) on a four-bar meter. The rows are already
//    in ascending order and already carry the metal, so the words restated
//    what position and colour had said — cognitive load for nothing. The
//    header states once that rewards climb; the ladder shows how far.

export function ClassLadder() {
  const { key, followers, unknown } = useConsumerClass();

  return (
    <ol className="flex flex-col gap-2">
      {CLASSES.map((c) => {
        // NOBODY IS CURRENT WHEN WE DIDN'T READ THE CLASS. The floor fallback
        // makes a failed profile read indistinguishable from a real Bronze
        // account, and this ladder is the one surface where that difference
        // IS the content. The rungs still render — they teach what the
        // classes are, which is true regardless — but none is marked, and
        // `aria-current` never asserts a rung the app couldn't read.
        const current = !unknown && key === c.id;
        // PER-RUNG, not one shared reach flag (MESITA-1125). The bars are
        // banded — 1,000 / 5,000 / 20,000 — so a single boolean would have
        // shown Gold unlocked to a guest with 1,000 followers, who is Silver.
        //
        // The manual door needs no branch here (MESITA-1126). An invitation
        // NAMES a class and grants it outright, so an invited guest arrives
        // with that rung already as `key` — it reads as `current`, which is
        // the truth. The old `diamond && doors.invitation` case encoded the
        // retired idea that invitations only ever led to the top rung.
        const unlocked =
          !unknown && (current || followers >= c.followerThreshold);

        return (
          <li
            key={c.id}
            aria-current={current ? "true" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-2xl p-3.5",
              current
                ? cn("shadow-rest", classBadgeClass(c.id))
                : "border-border bg-card border",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                // THE METAL IS THE TILE, NOT THE STROKES (decision: Pato). The
                // mark used to be drawn IN the class colour, which put the
                // colour on four hairlines an 18px glyph wide — Silver was
                // illegible and Bronze read as a smudge. Colour still means
                // class, it just lives on the fill now, with the mark in the
                // ink `classBadgeClass` pairs with it (white, or foreground on
                // Silver's light fill). The current row keeps its inset tile:
                // the card underneath is already the metal.
                current
                  ? "bg-white/20"
                  : unlocked
                    ? classBadgeClass(c.id)
                    : "bg-muted text-muted-foreground/50",
              )}
            >
              <CLASS_MARK_ICON className="h-[18px] w-[18px]" />
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
                  // NO FADE ON THE CURRENT ROW. `opacity-90` used to sit
                  // here for hierarchy, but size and weight already carry
                  // that (15px bold name vs 12px requirement) and the fade
                  // cost the only thing it could: contrast. It pushed gold's
                  // requirement line to 4.48:1, just under AA. Full ink lands
                  // every rung between 6.29:1 and 8.24:1.
                  "mt-0.5 flex items-center gap-1 text-[12px] leading-snug",
                  current ? undefined : "text-muted-foreground",
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
