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
//
// Since MESITA-2401 it sits at the right edge of Search's HEADER
// (`variant="header"`): bordered like Home's location, the segmented
// track's height (MESITA-2404), no shadow. Without `onOpenFilters` (Search › Chat) it is disabled in place.
export function SearchFilterRow({
  count,
  onOpenFilters,
  variant = "floating",
}: {
  count: number;
  onOpenFilters?: () => void;
  variant?: "floating" | "header";
}) {
  const applied = count > 0;
  const disabled = !onOpenFilters;
  return (
    <button
      type="button"
      onClick={onOpenFilters}
      disabled={disabled}
      aria-label={disabled ? "Filters (not for Chat yet)" : applied ? `Filters, ${count} applied` : "Filters"}
      aria-haspopup="dialog"
      aria-pressed={applied}
      className={
        variant === "header"
          ? "border-border bg-card text-foreground hover:bg-muted relative flex h-10 w-10 shrink-0 border items-center justify-center rounded-full transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
          : "shadow-elev border-border bg-card/95 text-foreground relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border backdrop-blur-xl transition active:scale-[0.97]"
      }
      data-search-filters
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
