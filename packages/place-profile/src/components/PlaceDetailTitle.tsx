"use client";

import { cn } from "../lib/format";
import { EnrichedBadge } from "./EnrichedBadge";

// Centered place-name title for the detail header (page + modal).
// decision: Pato (MESITA-451, revised) — the live "Enriching" state moved
// off the title into a dedicated chip in the profile summary (before the
// category chip, see PlaceDetailBody), so the name stays clean in the
// top chrome. An enriched place wears the Enriched mark after its name
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
        "font-display flex min-w-0 flex-1 items-center justify-center gap-1.5 text-base font-semibold",
        className,
      )}
    >
      <span className="truncate">{placeName}</span>
      {enriched ? <EnrichedBadge /> : null}
    </div>
  );
}
