"use client";

import { type AdminPlace } from "../actions";
import { CheckPinCard } from "./CheckPinCard";
import { ReservationsCard } from "./ReservationsCard";
import { TeamSection } from "./TeamSection";

// Settings — what a business may set for its own place, which is why these are
// the cards the business console mirrors (MESITA-834; Team's own tab folded in
// per Pato, same day): Reservations channel (MESITA-837), the optional Check
// PIN (MESITA-823) and Team (managers + invites — no waiters, that identity is
// gone, MESITA-833). Profile content stays on Place; everything
// Mesita-internal moved to the Admin tab (Pato, 2026-08-04).
export function SettingsSection({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  return (
    // Same masonry as the Place tab — columns pack top-down (MESITA-399).
    <div className="columns-1 gap-4 pb-8 [&>section]:mb-4 [&>section]:break-inside-avoid [&>details]:mb-4 [&>details]:break-inside-avoid lg:columns-2 lg:gap-5 lg:pb-10 lg:[&>section]:mb-5 lg:[&>details]:mb-5">
      <ReservationsCard place={place} onSaved={onSaved} />
      <CheckPinCard place={place} />
      <TeamSection place={place} />
    </div>
  );
}
