"use client";

import {
  CalendarCheck,
  ChevronRight,
  Loader2,
  Lock,
  QrCode,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { ORDER_BLOCKED, RESERVE_BLOCKED } from "@/components/consumer/place-detail/place-actions-copy";
import { useConsumerIdentity } from "@/lib/class-context";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { useStartVisit } from "@/lib/hooks/useStartVisit";
import type { SeedPlace } from "@/lib/ticket-seed";
import { ERROR_BOX_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { isPromoting } from "@/lib/promo-rates";
import {
  isOrderActionEnabled,
  isReserveActionEnabled,
} from "@/lib/place-profile-actions";

// The Go sheet (MESITA-1072) — what the deck's fifth action button opens.
//
// The rail used to end in a calendar wired straight to ReservationSheet: one
// verb, and the narrowest of the three the product actually offers. Place
// detail already carries all three in a pinned bar (MESITA-1065) and each one
// lands in an Inbox section that exists (MESITA-1053), so the deck was simply
// a verb behind. This catches it up without spending a sixth slot in a rail
// that is already at its width budget.
//
// WHY A SHEET AND NOT THREE MORE BUTTONS. The rail is icon-only and sized for
// five circles; three commitment verbs cannot live there without either
// shrinking the whole row or dropping Filter/Place. A sheet also buys each
// verb a line of explanation, which the bar on place detail has no room for —
// and the guest arriving from a swipe card has read far less about this place
// than the guest who opened its detail page.
//
// SELF-CONTAINED ON PURPOSE, not a refactor of PlaceActionBar. The part that
// must never drift is already shared as code: useStartVisit owns the create,
// the two-arm 409 race recovery and the seed THE TICKET paints from. What is
// left is presentation wiring — one partner boolean and a Reserve hand-off —
// and deduping ~30 lines of that would mean reopening a bar that shipped the
// day before, for no behavioural gain. The one thing that would genuinely rot
// if copied, the blocked-Order contract, is a shared constant instead.

export function GoSheet({
  place,
  open,
  onClose,
  onReserve,
}: {
  place: SeedPlace;
  open: boolean;
  onClose: () => void;
  /** Hands Reserve back to the deck, which already owns ReservationSheet.
   *  Two LocalSheets both sliding up from the bottom at the same z-tier read
   *  as a rendering bug, so the deck SWAPS them rather than stacking. */
  onReserve: () => void;
}) {
  const { userId } = useConsumerIdentity();
  const tickets = useConsumerTickets(userId);
  const { pickPlace, startingId, error } = useStartVisit({
    activeTickets: tickets.active,
    onCreated: () => {
      void tickets.refresh();
    },
  });
  const promoting = isPromoting(place);
  const orderEnabled = isOrderActionEnabled(place);
  const reserveEnabled = isReserveActionEnabled(place);
  const starting = startingId === place.id;
  // A live ticket here means the tap RE-OPENS it instead of making a second
  // one (useStartVisit D5). The row says so up front — otherwise "Visit" reads
  // as "spend again" to a guest who is already holding one.
  const live = tickets.active.some((t) => t.project_id === place.id);

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel={`Go to ${place.name}`}>
      <div className="p-5">
        <h2 className={SHEET_TITLE_CLASS}>Go to {place.name}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Three ways in — pick one.
        </p>

        {/* The create can fail (cold EF, dropped connection). Swallowing it
              would leave a tap that visibly did nothing. */}
        {error ? <p className={cn(ERROR_BOX_CLASS, "mt-3")}>{error}</p> : null}

        <div className="mt-4 flex flex-col gap-2">
          {/* VISIT — the money action, so it's the only tinted row.
                Non-partners render LOCKED rather than hidden, matching
                PlaceActionBar and PlacePickList: consumer-web-create-ticket
                409s `not_partner`, so an enabled row would be a dead end —
                but hiding it would tell the guest the app is missing a
                feature, when the truth is this place isn't a partner yet. */}
          <GoOption
            Icon={starting ? Loader2 : promoting ? QrCode : Lock}
            spin={starting}
            title="Visit"
            hint={
              !promoting
                ? "This place isn't running a Mesita reward right now."
                : live
                  ? "You have a live ticket here — open it."
                  : "Start your ticket and show the QR at the table."
            }
            onClick={() => pickPlace(place)}
            disabled={!promoting || starting}
            primary={promoting}
          />

          {/* ORDER — unlocked when a menu/catalog is on file. */}
          <GoOption
            Icon={orderEnabled ? UtensilsCrossed : Lock}
            title="Order"
            hint={orderEnabled ? "Menu on file at this place." : ORDER_BLOCKED.hint}
            disabled={!orderEnabled}
          />

          <GoOption
            Icon={reserveEnabled ? CalendarCheck : Lock}
            title="Reserve"
            hint={
              reserveEnabled
                ? "Book a table for later."
                : RESERVE_BLOCKED.hint
            }
            onClick={reserveEnabled ? onReserve : undefined}
            disabled={!reserveEnabled}
          />
        </div>
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
  disabled,
  primary,
  spin,
}: {
  Icon: LucideIcon;
  title: string;
  hint: string;
  onClick?: () => void;
  disabled?: boolean;
  /** The one tinted row — Visit, when this place can actually honour it. */
  primary?: boolean;
  spin?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition",
        "active:scale-[0.99] motion-reduce:active:scale-100",
        "disabled:pointer-events-none",
        primary
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card hover:bg-muted",
        disabled && !spin && "opacity-60",
      )}
    >
      <span
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
          primary
            ? "bg-primary text-primary-foreground shadow-glow"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon
          className={cn("h-5 w-5", spin && "animate-spin")}
          strokeWidth={2.25}
        />
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
