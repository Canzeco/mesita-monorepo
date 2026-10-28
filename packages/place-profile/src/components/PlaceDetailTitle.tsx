"use client";

import { cn } from "../lib/format";
import { PLACE_BONE_CLASS } from "../lib/ui";
import { PremierBadge } from "./PremierBadge";

// The place-name title for the detail header (page + modal). Since
// MESITA-2619 it sits at the LEFT beside the back chevron in bold sans, the
// way Instagram sets a profile's username; it was centred in the serif
// display face.
// decision: Pato (MESITA-451, revised) — the live "Enriching" state moved
// off the title into a dedicated chip in the profile summary (before the
// category chip, see PlaceDetailBody), so the name stays clean in the
// top chrome. A Premier place wears the Premier mark and its level right
// after its name, "Premier 2X" (MESITA-2925; Selected's check stood there
// from MESITA-2913, Enriched's from MESITA-2296, at 20px since MESITA-2628).
// A NULL NAME IS ONE STILL ON ITS WAY (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"): a 16px
// bone in this same row, where the name will stand (PlaceTopBarSkeleton).

export function PlaceDetailTitle({
  placeName,
  premierTier = 0,
  className,
}: {
  placeName: string | null;
  /** `boost_tier`: 1..3 draws the Premier mark, 0 nothing (MESITA-2925). */
  premierTier?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-1.5 text-base font-bold tracking-tight",
        className,
      )}
    >
      {placeName == null ? (
        <span aria-hidden className={cn(PLACE_BONE_CLASS, "h-4 w-40 max-w-full")} />
      ) : (
        <>
          {/* The name truncates and the mark is shrink-0, so a long name
              ends in an ellipsis and the mark stays whole right after it. */}
          <span className="truncate">{placeName}</span>
          <PremierBadge tier={premierTier} />
        </>
      )}
    </div>
  );
}
