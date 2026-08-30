"use client";

import { type AdminPlace } from "../actions";
import { TeamSection } from "./TeamSection";

// Settings — PEOPLE, not rails (Pato live 2026-08-30). The three rail boxes
// that used to live here — Visits, Orders, Reservations — moved to the
// Partnership tab, because every one of them configures a capability the
// place offers through Mesita, and Partnership is where a place's offerings
// are set. Settings keeps what is not an offering: Team.
//
// The one-box-per-rail rule (Pato live 2026-08-20, MESITA-1148) still holds —
// it moved tabs, it did not change shape. Visits still carries the Check PIN
// (MESITA-823) and the bill is still always required (MESITA-1095); both now
// read on Partnership. Profile content stays on Place; everything
// Mesita-internal is on the Admin tab (Pato, 2026-08-04).
export function SettingsSection({ place }: { place: AdminPlace }) {
  return (
    // Same masonry as the Place tab — columns pack top-down (MESITA-399).
    <div className="columns-1 gap-4 pb-8 [&>section]:mb-4 [&>section]:break-inside-avoid [&>details]:mb-4 [&>details]:break-inside-avoid lg:columns-2 lg:gap-5 lg:pb-10 lg:[&>section]:mb-5 lg:[&>details]:mb-5">
      <TeamSection place={place} />
    </div>
  );
}
