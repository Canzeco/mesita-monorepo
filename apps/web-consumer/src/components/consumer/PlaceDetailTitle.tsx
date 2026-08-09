"use client";

import { cn } from "@/lib/utils";

import { VerifiedCheck } from "./VerifiedCheck";

// Centered place-name title for the detail header (page + modal).
// decision: Pato (MESITA-451, revised) — the live "Enriching" state moved
// off the title into a dedicated chip in the profile summary (before the
// verification chip, see PlaceDetailBody), so the name stays clean in the
// top chrome.
// decision: MESITA-933 — blue verify disc beside the name when partner only.
// Unverified has no disc (Verification box / swipe tag carries the label).

export function PlaceDetailTitle({
  placeName,
  listingType,
  className,
}: {
  placeName: string;
  listingType?: "partner" | "web";
  className?: string;
}) {
  const isVerified = listingType === "partner";

  return (
    <div
      className={cn(
        "font-display flex min-w-0 flex-1 items-center justify-center gap-1.5 text-base font-semibold",
        className,
      )}
    >
      <span className="truncate">{placeName}</span>
      {isVerified && <VerifiedCheck className="h-4 w-4 shrink-0" />}
    </div>
  );
}
