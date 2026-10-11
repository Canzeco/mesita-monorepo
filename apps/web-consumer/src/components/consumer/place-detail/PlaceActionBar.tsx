"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";

import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
import type { PlaceDetail } from "@/lib/place-detail";
import { cn } from "@/lib/utils";
import { isReserveActionEnabled } from "@/lib/place-profile-actions";

// The place-detail action bar (MESITA-1065): Reserve, pinned.
//
// FIXED MEANS OUTSIDE THE SCROLL CONTAINER, not `position: fixed`. Both
// callers — PlaceDetailPageBody and PlaceDetailModalShell — are flex columns
// of `header (shrink-0)` + `flex-1 min-h-0 overflow-y-auto`; this bar is a
// third shrink-0 sibling after the scroll area. That pins it with no new
// z-tier and no fight with BottomNav (z-40) or the slide-over (z-120), and it
// can't escape the MobileFrame card on desktop the way `fixed` would.
//
// WHY IT IS DOWN HERE. The body's row keeps the verbs that act on your
// relationship to the PAGE (Save · Contact · Share); Reserve commits you to
// being at the place, and it lands somewhere afterwards (Me › Reservations),
// so it gets the pinned band.
//
// THE CELL STACKS — icon over label. The bar has drawn Reserve alone this way
// since MESITA-2077; a single wide cell with the glyph beside the word read
// as a stray toolbar button rather than the page's one commitment.

export function PlaceActionBar({
  place,
  className,
}: {
  place: PlaceDetail;
  className?: string;
}) {
  const [reserveOpen, setReserveOpen] = useState(false);

  // A walk-in place leaves no verb at all: one disabled Reserve cell would be
  // a dead strip pinned to the screen, so the bar steps aside. The page's
  // Save · Contact · Share still render above.
  if (!isReserveActionEnabled(place)) return null;

  return (
    <>
      <div
        className={cn(
          "border-border bg-card/95 shrink-0 border-t px-4 pt-3 pb-4 backdrop-blur",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setReserveOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={reserveOpen}
          aria-label="Reserve a table"
          className="border-border bg-card text-foreground hover:bg-muted type-body inline-flex w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2.5 font-semibold whitespace-nowrap transition active:scale-[0.99]"
        >
          <CalendarCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Reserve
        </button>
      </div>

      <ReservationSheet
        place={place}
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
      />
    </>
  );
}
