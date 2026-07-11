"use client";

import { useState } from "react";
import { CalendarCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// The Reservations surface (the Reservations bottom-tab lands here). It used
// to be the "Saved" page — a Places grid + a parked Reservations tab — but
// saving a place now lives on Home > Favorites, so this surface is purely
// about reservations: two sub-tabs, Upcoming and History.
//
// Booking a table from Mesita isn't live yet, so both tabs render polished
// empty states (Upcoming carries the coming-soon framing). Once the booking
// flow ships, these bodies fill with real reservation rows — the parked
// ReservationCard / Calendar / WhatsApp building blocks stay in the tree.

export const dynamic = "force-dynamic";

type Tab = "upcoming" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "history", label: "History" },
];

export default function ReservationsPage() {
  const [tab, setTab] = useState<Tab>("upcoming");

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">
        <div className="border-border bg-card grid grid-cols-2 gap-0 rounded-2xl border p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl px-1 py-1.5 text-center text-[12px] font-medium transition",
                tab === t.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "upcoming" ? <UpcomingBody /> : <HistoryBody />}
      </div>
    </div>
  );
}

function UpcomingBody() {
  return (
    <ReservationsEmptyState
      icon={<CalendarCheck className="h-7 w-7" strokeWidth={2} />}
      eyebrow="Coming soon"
      title="No upcoming reservations"
      body="Booking a table straight from Mesita is on the way. We'll let you know the moment reservations go live."
    />
  );
}

function HistoryBody() {
  return (
    <ReservationsEmptyState
      icon={<Clock className="h-7 w-7" strokeWidth={2} />}
      title="No past reservations"
      body="Your dining history will show up here once you've booked and visited a place through Mesita."
    />
  );
}

function ReservationsEmptyState({
  icon,
  eyebrow,
  title,
  body,
}: {
  icon: React.ReactNode;
  eyebrow?: string;
  title: string;
  body: string;
}) {
  return (
    <div className="scrollbar-hide h-full overflow-y-auto">
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <span className="bg-pink-gradient shadow-glow flex h-16 w-16 items-center justify-center rounded-2xl text-white">
          {icon}
        </span>
        <div className="flex flex-col items-center gap-1.5">
          {eyebrow && (
            <span className="text-primary text-[11px] font-semibold tracking-[0.18em] uppercase">
              {eyebrow}
            </span>
          )}
          <h2 className="font-display text-xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-muted-foreground max-w-xs text-sm leading-snug">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}
