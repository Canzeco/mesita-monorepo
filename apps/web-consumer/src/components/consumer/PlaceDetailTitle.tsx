"use client";

import { cn } from "@/lib/utils";

import { PartnerMark } from "./PartnerMark";

// Centered place-name title for the detail header (page + modal).
// decision: Pato (MESITA-451, revised) — the live "Enriching" state moved
// off the title into a dedicated chip in the profile summary (before the
// verification chip, see PlaceDetailBody), so the name stays clean in the
// top chrome.
// decision: Pato — the mark beside the name is the PARTNER mark. It was a blue
// "verified" check fired by `promoting`; verification is Mesita's own
// bookkeeping and is off consumer surfaces entirely.
// decision: Pato (MESITA-2031) — it is the verified ROSETTE now, in
// `--partner` red. It was `text-primary`, which MESITA-1934 repointed to
// near-black: a black disc beside a black name, invisible as a badge.

export function PlaceDetailTitle({
  placeName,
  partner,
  className,
}: {
  placeName: string;
  partner?: boolean;
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
      {partner === true && (
        <PartnerMark className="text-partner h-4 w-4 shrink-0" />
      )}
    </div>
  );
}
