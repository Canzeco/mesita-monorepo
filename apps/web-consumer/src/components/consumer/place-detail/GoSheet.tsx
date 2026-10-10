"use client";

import { CalendarCheck, ChevronRight, type LucideIcon } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { RESERVE_BLOCKED } from "@/components/consumer/place-detail/place-actions-copy";
import type { Place } from "@/lib/api/places";
import { SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { isReserveActionEnabled } from "@/lib/place-profile-actions";

// The Go sheet (MESITA-1072) — what the deck's fifth action button opens.
//
// The rail is icon-only and sized for five circles, so the commitment verb
// cannot live there without shrinking the row or dropping Filter/Place. A
// sheet also buys the verb a line of explanation, which the bar on place
// detail has no room for — and the guest arriving from a swipe card has read
// far less about this place than the guest who opened its detail page.
//
// IT MIRRORS THE BAR ON PURPOSE. Both surfaces answer the same question —
// what can I start here — so they read the same gate (isReserveActionEnabled).
// The bar hides when the answer is no; the sheet has room to say why, and
// says it with RESERVE_BLOCKED.

export function GoSheet({
  place,
  open,
  onClose,
  onReserve,
}: {
  place: Place;
  open: boolean;
  onClose: () => void;
  /** Hands Reserve back to the deck, which already owns ReservationSheet.
   *  Two LocalSheets both sliding up from the bottom at the same z-tier read
   *  as a rendering bug, so the deck SWAPS them rather than stacking. */
  onReserve: () => void;
}) {
  const reserveEnabled = isReserveActionEnabled(place);

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel={`Go to ${place.name}`}>
      <div className="p-5">
        <h2 className={SHEET_TITLE_CLASS}>Go to {place.name}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {reserveEnabled ? "Book a table." : RESERVE_BLOCKED.hint}
        </p>

        {/* Walk-in: the subtitle already says so, and a lone disabled row
            under it would be a dead end. */}
        {reserveEnabled && (
          <div className="mt-4 flex flex-col gap-2">
            <GoOption
              Icon={CalendarCheck}
              title="Reserve"
              hint="Book a table for later."
              onClick={onReserve}
            />
          </div>
        )}
      </div>
    </LocalSheet>
  );
}

// One choice row: tinted icon square, verb, one line of what happens next,
// chevron. The chevron is safe here in a way it would not be on the rail —
// on a list row it reads as "this leads somewhere", where on a swipe-deck
// action button a right-pointing glyph would collide with the save gesture.
function GoOption({
  Icon,
  title,
  hint,
  onClick,
}: {
  Icon: LucideIcon;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition",
        "active:scale-[0.99] motion-reduce:active:scale-100",
        "border-border bg-card hover:bg-muted",
      )}
    >
      <span className="bg-muted text-muted-foreground grid h-11 w-11 shrink-0 place-items-center rounded-xl">
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="text-muted-foreground block text-xs leading-snug">
          {hint}
        </span>
      </span>
      <ChevronRight
        className="text-muted-foreground h-4 w-4 shrink-0"
        aria-hidden="true"
      />
    </button>
  );
}
