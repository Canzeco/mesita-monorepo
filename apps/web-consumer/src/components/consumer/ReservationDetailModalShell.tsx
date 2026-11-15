"use client";

import { SlideOverHeader } from "@/components/consumer/overlay/SlideOverShell";

// Content chrome for the intercepted /reservation/[id] route. The sliding
// panel (animation, backdrop, ESC, dismiss via router.back) is
// SlideOverShell, mounted from the segment's layout.tsx — this only fills it
// with header + scroll body, on white like every page (MESITA-4115). No
// action in the header: Share is gone (Pato, MESITA-4115: "share
// reservation button must not be there"); the body's own rows (View place,
// Reschedule, Cancel) are the reservation's actions.
// THE SKELETON IS THIS SHELL TOO (Pato, MESITA-2701: "the placeholders must
// be similar to the page you are loading, like the sizes"): the segment's
// loading.tsx and the fetch's wait both draw it around
// ReservationBodySkeleton.

export function ReservationDetailModalShell({
  children,
}: {
  children: React.ReactNode;
  /** Kept for the callers; the header no longer uses it. */
  placeName?: string | null;
}) {
  return (
    <div className="bg-card flex min-h-0 flex-1 flex-col">
      <SlideOverHeader title="Reservation" />
      {/* `min-h-0` is load-bearing — see PlaceDetailModalShell. */}
      <div className="scrollbar-thin-dark min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
