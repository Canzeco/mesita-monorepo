"use client";

import { useState } from "react";
import { CalendarCheck, Loader2, Lock, QrCode, UtensilsCrossed } from "lucide-react";

import { ORDER_BLOCKED, RESERVE_BLOCKED } from "@/components/consumer/place-detail/place-actions-copy";
import { ReservationSheet } from "@/components/consumer/place-detail/ReservationSheet";
import { useConsumerIdentity } from "@/lib/class-context";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { useStartVisit } from "@/lib/hooks/useStartVisit";
import type { PlaceDetail } from "@/lib/mock/place";
import { cn } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { isPromoting } from "@/lib/promo-rates";
import {
  isOrderActionEnabled,
  isReserveActionEnabled,
} from "@/lib/place-profile-actions";

// The place-detail action bar (MESITA-1065): Visit · Order · Reserve, pinned.
//
// FIXED MEANS OUTSIDE THE SCROLL CONTAINER, not `position: fixed`. Both
// callers — PlaceDetailPageBody and PlaceDetailModalShell — are flex columns
// of `header (shrink-0)` + `flex-1 min-h-0 overflow-y-auto`; this bar is a
// third shrink-0 sibling after the scroll area. That pins it with no new
// z-tier and no fight with BottomNav (z-40) or the slide-over (z-120), and it
// can't escape the MobileFrame card on desktop the way `fixed` would.
//
// WHY THESE THREE WORDS. They are not new vocabulary: Inbox already tracks
// Visits · Orders · Reservations (MESITA-1053), so the bar is "the three
// things you can start here" and each one has somewhere it lands afterwards.
// The body's row keeps the verbs that act on your relationship to the PAGE
// (Save · Contact · Share); commitment verbs live down here.

export function PlaceActionBar({
  place,
  className,
}: {
  place: PlaceDetail;
  className?: string;
}) {
  const { userId } = useConsumerIdentity();
  const tickets = useConsumerTickets(userId);
  const { pickPlace, startingId, error } = useStartVisit({
    activeTickets: tickets.active,
    onCreated: () => {
      void tickets.refresh();
    },
  });
  const [reserveOpen, setReserveOpen] = useState(false);

  // Gated on the LIVE reward, not the stored badge: a paused place used to
  // let a guest open a ticket that nothing at the table would honor.
  const promoting = isPromoting(place);
  const orderEnabled = isOrderActionEnabled(place);
  const reserveEnabled = isReserveActionEnabled(place);
  const starting = startingId === place.id;

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-xl py-3 type-body font-semibold whitespace-nowrap transition active:scale-[0.99] disabled:active:scale-100";
  const outline = "border-border bg-card text-foreground hover:bg-muted border";

  return (
    <>
      <div
        className={cn(
          "border-border bg-card/95 shrink-0 border-t px-4 pt-3 pb-4 backdrop-blur",
          className,
        )}
      >
        {/* The create can fail (cold EF, dropped connection). The bar has no
            room for a panel, but swallowing it would leave a tap that visibly
            did nothing — one line, above the row, in place. */}
        {error ? (
          <p className={cn(ERROR_BOX_CLASS, "mb-2 py-1.5")}>
            {error}
          </p>
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          {/* VISIT — the money action, so it's the only filled button.
              Same one-tap contract as the Visit wallet: create at "base" and
              land on THE TICKET; a place already holding a live ticket
              re-opens it instead of 409-ing (useStartVisit owns both arms).

              Non-partners render LOCKED rather than hidden, matching
              PlacePickList: consumer-web-create-ticket 409s `not_partner`, so
              an enabled button here would be a dead end — but hiding it would
              tell the guest this place is missing a feature the app has, when
              what's actually true is that this place isn't a partner yet. */}
          <button
            type="button"
            onClick={() => pickPlace(place)}
            disabled={!promoting || starting}
            aria-label={
              promoting
                ? "Start a visit"
                : "Visits aren't available at this place yet"
            }
            title={
              promoting
                ? undefined
                : "This place isn't running a Mesita reward right now."
            }
            className={cn(
              btn,
              promoting
                ? "bg-primary text-primary-foreground shadow-glow hover:opacity-95"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            {starting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : promoting ? (
              <QrCode className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            ) : (
              <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            )}
            Visit
          </button>

          {/* ORDER — unlocked when Intaker stamped a menu/catalog (Actions).
              Mesita table ordering is still staged; the slot stays visible. */}
          <button
            type="button"
            disabled={!orderEnabled}
            aria-label={orderEnabled ? "Order at this place" : ORDER_BLOCKED.aria}
            title={orderEnabled ? undefined : ORDER_BLOCKED.title}
            className={cn(
              btn,
              orderEnabled
                ? outline
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            {orderEnabled ? (
              <UtensilsCrossed className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            ) : (
              <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            )}
            Order
          </button>

          {/* RESERVE — unlocked when Description infers reservations are typical. */}
          <button
            type="button"
            onClick={reserveEnabled ? () => setReserveOpen(true) : undefined}
            disabled={!reserveEnabled}
            aria-haspopup={reserveEnabled ? "dialog" : undefined}
            aria-expanded={reserveEnabled ? reserveOpen : undefined}
            aria-label={
              reserveEnabled ? "Reserve a table" : RESERVE_BLOCKED.aria
            }
            title={reserveEnabled ? undefined : RESERVE_BLOCKED.title}
            className={cn(
              btn,
              reserveEnabled
                ? outline
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            {reserveEnabled ? (
              <CalendarCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            ) : (
              <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            )}
            Reserve
          </button>
        </div>
      </div>

      <ReservationSheet
        place={place}
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
      />
    </>
  );
}
