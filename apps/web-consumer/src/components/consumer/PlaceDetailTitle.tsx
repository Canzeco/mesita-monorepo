"use client";

import { cn } from "@/lib/utils";

// Centered place-name title for the detail header (page + modal).
// decision: Pato (MESITA-451, revised) — the live "Enriching" state moved
// off the title into a dedicated chip in the profile summary (before the
// verification chip, see PlaceDetailBody), so the name stays clean in the
// top chrome.

export function PlaceDetailTitle({
  placeName,
  className,
}: {
  placeName: string;
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
    </div>
  );
}
