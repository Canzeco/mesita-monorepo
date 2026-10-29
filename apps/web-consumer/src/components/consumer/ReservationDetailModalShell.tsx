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
// THE SKELETON IS THIS SHELL TOO (Pato, MESITA-2701: "the placeholders must
// be similar to the page you are loading, like the sizes"): the segment's
// loading.tsx and the fetch's wait both draw it around
// ReservationBodySkeleton with `placeName` null. The share square then
// stands where it will be, disabled until the reservation (and so the name
// it shares) is in hand.

export function ReservationDetailModalShell({
  children,
  placeName,
}: {
  children: React.ReactNode;
  /** Null while the reservation loads: the share square waits. */
  placeName: string | null;
}) {
  // The sheet, or a copy of the link: a sheet that fails copies instead of
  // ending silently (shareOrCopy, MESITA-2581).
  function onShare() {
    if (placeName == null) return;
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
            disabled={placeName == null}
            aria-label="Share"
            className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition"
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
