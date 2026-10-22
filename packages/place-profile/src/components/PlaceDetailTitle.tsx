"use client";

import { cn } from "../lib/format";
import { EnrichedBadge } from "./EnrichedBadge";

// The place-name title for the detail header (page + modal). Since
// MESITA-2619 it sits at the LEFT beside the back chevron in bold sans, the
// way Instagram sets a profile's username; it was centred in the serif
// display face.
// decision: Pato (MESITA-451, revised) — the live "Enriching" state moved
// off the title into a dedicated chip in the profile summary (before the
// category chip, see PlaceDetailBody), so the name stays clean in the
// top chrome. An enriched place wears the Enriched mark before its name (MESITA-2624; after it until then)
// (MESITA-2296).

export function PlaceDetailTitle({
  placeName,
  enriched = false,
  className,
}: {
  placeName: string;
  enriched?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-1.5 text-base font-bold tracking-tight",
        className,
      )}
    >
      {/* The Enriched mark leads the name (MESITA-2624), so a truncated
          name never pushes it to the cut end. */}
      {enriched ? <EnrichedBadge /> : null}
      <span className="truncate">{placeName}</span>
    </div>
  );
}
