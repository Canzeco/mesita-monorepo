"use client";

import { type AdminPlace } from "../actions";
import { OrdersCard } from "./OrdersCard";
import { ReservationsCard } from "./ReservationsCard";
import { TeamSection } from "./TeamSection";
import { VisitsCard } from "./VisitsCard";

// Settings — what a business may set for its own place, which is why these are
// the cards the business console mirrors (MESITA-834; Team's own tab folded in
// per Pato, same day). Profile content stays on Place; everything
// Mesita-internal is on the Admin tab (Pato, 2026-08-04).
//
// ONE BOX PER RAIL (Pato live 2026-08-20, MESITA-1148): "just create a box for
// visits / orders / reservations — but not fucking lots of visits." Mesita has
// exactly three things a guest can hold — a visit ticket, an order ticket, a
// reservation ticket — so the page is three boxes in that order, plus Team,
// which is people rather than a rail. Check PIN and Require bill used to be
// two cards; both are gates on the same visit ticket, so they are one Visits
// box with one save.
export function SettingsSection({ place }: { place: AdminPlace }) {
  return (
    // Same masonry as the Place tab — columns pack top-down (MESITA-399).
    <div className="columns-1 gap-4 pb-8 [&>section]:mb-4 [&>section]:break-inside-avoid [&>details]:mb-4 [&>details]:break-inside-avoid lg:columns-2 lg:gap-5 lg:pb-10 lg:[&>section]:mb-5 lg:[&>details]:mb-5">
      <VisitsCard place={place} />
      <OrdersCard place={place} />
      <ReservationsCard place={place} />
      <TeamSection place={place} />
    </div>
  );
}
