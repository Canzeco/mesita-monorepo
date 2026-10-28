"use client";

import { cn } from "../lib/format";
import { PLACE_BONE_CLASS } from "../lib/ui";
import { SelectedBadge } from "./SelectedBadge";

// The place-name title for the detail header (page + modal). Since
// MESITA-2619 it sits at the LEFT beside the back chevron in bold sans, the
// way Instagram sets a profile's username; it was centred in the serif
// display face.
// decision: Pato (MESITA-451, revised) — the live "Enriching" state moved
// off the title into a dedicated chip in the profile summary (before the
// category chip, see PlaceDetailBody), so the name stays clean in the
// top chrome. A Mesita Selected place wears the Selected mark right after
// its name (MESITA-2913; the Enriched mark stood there from MESITA-2296, and
// MESITA-2628 set it after the name at 20px).
// A NULL NAME IS ONE STILL ON ITS WAY (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"): a 16px
// bone in this same row, where the name will stand (PlaceTopBarSkeleton).

export function PlaceDetailTitle({
  placeName,
  selected = false,
  className,
}: {
  placeName: string | null;
  selected?: boolean;
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
          {selected ? <SelectedBadge /> : null}
        </>
      )}
    </div>
  );
}
