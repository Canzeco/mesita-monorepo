"use client";

import { SlidersHorizontal } from "lucide-react";

import { ActiveDot } from "./ActiveDot";

// The Filters control, TOP RIGHT, BESIDE THE BAR: a 44px disc wearing the
// sliders icon and nothing else (Pato, 2026-10-17: "don't mention filters
// as text, just the filters icon is enough and universal"). That retires
// the labelled third of MESITA-1797; the row is now location · bar ·
// filters, and the bar takes everything the two discs leave.
//
// IT WEARS THE BAR'S CHROME: same 44px height, same border, same
// `shadow-elev`, same blur. Three controls, one row.
//
// `shrink-0` IS THE ANTI-DISAPPEARING CLASS. A focused bar that grows past
// its track and eats its siblings is what a missing `min-w-0` on the bar's
// wrapper or a missing `shrink-0` here produces. Neither is cosmetic;
// `search-overlays.test.tsx` pins both.
//
// Applied wears the brand-red dot on its corner (MESITA-2304), the same
// mark the location disc wears for a held fix; the disc itself stays the
// bar's neutral chrome. The accessible name carries the word the disc no
// longer prints, and the count.
export function SearchFilterRow({
  count,
  onOpenFilters,
}: {
  count: number;
  onOpenFilters: () => void;
}) {
  const applied = count > 0;
  return (
    <button
      type="button"
      onClick={onOpenFilters}
      aria-label={applied ? `Filters, ${count} applied` : "Filters"}
      aria-haspopup="dialog"
      aria-pressed={applied}
      className="shadow-elev border-border bg-card/95 text-foreground relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border backdrop-blur-xl transition active:scale-[0.97]"
    >
      <SlidersHorizontal
        className="h-5 w-5 shrink-0"
        strokeWidth={2.25}
        aria-hidden
      />
      {applied ? <ActiveDot /> : null}
    </button>
  );
}
