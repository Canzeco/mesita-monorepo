"use client";

import { Share2 } from "lucide-react";
import { SlideOverHeader } from "@/components/consumer/overlay/SlideOverShell";
import { shareOrCopy } from "@/lib/share-place";

// Content chrome for the intercepted /reservation/[id] route. The sliding
// panel (animation, backdrop, ESC, dismiss via router.back) is
// SlideOverShell, mounted from the segment's layout.tsx — this only fills it
// with header + scroll body. No action bar: the body's own buttons (View
// place / Add to calendar / Call / Cancel) cover the reservation-level
// actions.

export function ReservationDetailModalShell({
  children,
  placeName,
}: {
  children: React.ReactNode;
  placeName: string;
}) {
  // The sheet, or a copy of the link: a sheet that fails copies instead of
  // ending silently (shareOrCopy, MESITA-2581).
  function onShare() {
    const url = window.location.href;
    void shareOrCopy(
      {
        title: `${placeName} on Mesita`,
        text: `My reservation at ${placeName}`,
        url,
      },
      { text: url, copied: "Link copied", failed: "Couldn't copy the link" },
    );
  }

  return (
    <>
      <SlideOverHeader
        title="Reservation"
        actions={
          <button
            type="button"
            onClick={onShare}
            aria-label="Share"
            className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition"
          >
            <Share2 className="h-4 w-4" />
          </button>
        }
      />
      {/* `min-h-0` is load-bearing — see PlaceDetailModalShell. */}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </>
  );
}
