"use client";

import { Spinner } from "@/components/shared";
import { cn } from "@/lib/utils";

// Centered place-name title for the detail header (page + modal). When the
// Enricher is still building the profile, append "(Enriching)" + a spinner
// to the right of the name — decision: Pato MESITA-451 (moved off the
// bottom Last-update box so the live state is visible without scrolling).

export function PlaceDetailTitle({
  placeName,
  isEnriching,
  className,
}: {
  placeName: string;
  isEnriching?: boolean;
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
      {isEnriching ? (
        <span
          className="text-emerald-600 inline-flex shrink-0 items-center gap-1"
          aria-live="polite"
        >
          <span className="whitespace-nowrap">(Enriching)</span>
          <Spinner
            size="sm"
            label="Enriching"
            className="h-3.5 w-3.5 border-emerald-300 border-t-emerald-600"
          />
        </span>
      ) : null}
    </div>
  );
}
