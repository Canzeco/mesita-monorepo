"use client";

import { CalendarCheck } from "lucide-react";

// Reservations is parked behind a "Soon" coming-soon state for now. The
// booking flow isn't live yet, so this surface renders ZERO tickets (no
// mock reservations, no filter pills, no calendar/reminders preview) — just
// a single premium coming-soon panel. The standalone /reservations route and
// the Saved page's "Reservations" tab both mount ReservationsBody, so this
// one change parks every entry point. (The mock data + ReservationCard /
// Calendar / WhatsApp building blocks stay in the tree, unused, for an easy
// un-park once booking ships.)

export const dynamic = "force-dynamic";

export default function ReservationsPage() {
  return <ReservationsBody />;
}

// Exported so the Saved page can mount it as its "Reservations" sub-tab
// without duplicating layout (the standalone /reservations route stays
// reachable for deep links).
export function ReservationsBody() {
  return (
    <div className="scrollbar-hide h-full overflow-y-auto">
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <span className="bg-pink-gradient shadow-glow flex h-16 w-16 items-center justify-center rounded-2xl text-white">
          <CalendarCheck className="h-7 w-7" strokeWidth={2} />
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-primary text-[11px] font-semibold tracking-[0.18em] uppercase">
            Coming soon
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Reservations
          </h2>
          <p className="text-muted-foreground max-w-xs text-sm leading-snug">
            Booking a table straight from Mesita is on the way. For now, save
            the places you love — we&apos;ll let you know the moment
            reservations go live.
          </p>
        </div>
      </div>
    </div>
  );
}
