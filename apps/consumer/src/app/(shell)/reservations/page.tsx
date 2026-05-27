"use client";

import { useMemo, useState } from "react";
import { SimpleHeader } from "@/components/consumer/SimpleHeader";
import { SavedItemCard } from "@/components/consumer/SavedItemCard";
import { TicketSheet } from "@/components/consumer/TicketSheet";
import { CalendarConnectBox } from "./CalendarConnectBox";
import { RESERVATIONS } from "@/lib/consumer-data";
import type { SavedItem } from "@/lib/consumer-data";
import {
  useReservations,
  type Reservation,
} from "@/lib/reservations";
import { cn } from "@/lib/utils";

// Top-level Reservations surface. Lifted out of the old /saved tabs when
// the BottomNav restructured — reservations are their own first-class
// entity now (separate from the coupons wallet). This page intentionally
// shows ONLY booking details (date, time, party size, venue) — discount
// info lives on the linked coupon in /coupons.
//
// Backed by mock fixtures + the localStorage-backed useReservations
// store. Once consumer-list-reservations is wired in (PR #27 in the
// entity-split sequence) this becomes an EF call and the fixtures go
// away.

export const dynamic = "force-dynamic";

type Filter = "upcoming" | "past" | "cancelled";

export default function ReservationsPage() {
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [openItem, setOpenItem] = useState<SavedItem | null>(null);

  // Dynamic reservations from the ReservationSheet (localStorage) merged
  // with the fixture seed so first-paint isn't empty.
  const dynamicReservations = useReservations();
  const items = useMemo<SavedItem[]>(() => {
    const dynamic = dynamicReservations
      .filter((r) => r.status === "upcoming")
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(toSavedItem);
    return [...dynamic, ...RESERVATIONS];
  }, [dynamicReservations]);

  return (
    <div className="relative flex h-full flex-col">
      <SimpleHeader title="Reservations" />

      <div className="px-4 pt-3">
        <p className="bg-secondary/10 text-secondary rounded-xl px-3 py-2 text-[11px]">
          Preview — reservations aren&apos;t connected to the backend yet.
        </p>
      </div>

      <div className="px-4 pt-3">
        <CalendarConnectBox />
      </div>

      <div className="px-4 pt-4">
        <div className="border-border bg-card scrollbar-hide flex gap-1 overflow-x-auto rounded-full border p-1">
          {(
            [
              { id: "upcoming", label: "Upcoming", count: 4 },
              { id: "past", label: "Past", count: 2 },
              { id: "cancelled", label: "Cancelled", count: 2 },
            ] as { id: Filter; label: string; count: number }[]
          ).map((f) => (
            <FilterPill
              key={f.id}
              active={filter === f.id}
              onClick={() => setFilter(f.id)}
              label={f.label}
              count={f.count}
            />
          ))}
        </div>
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 py-4">
        {filter === "upcoming" ? (
          <div className="flex flex-col gap-3">
            {items.map((r) => (
              <SavedItemCard
                key={r.id}
                item={r}
                onClick={() => setOpenItem(r)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            label={
              filter === "past"
                ? "No past reservations yet."
                : "No cancelled reservations."
            }
          />
        )}
      </div>

      {openItem && (
        <TicketSheet item={openItem} onClose={() => setOpenItem(null)} />
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition",
        active ? "bg-foreground text-background" : "text-muted-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0 text-[9px] font-bold",
          active
            ? "bg-background/20 text-background"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
      {label}
    </div>
  );
}

// Project a dynamic Reservation onto the existing SavedItem shape so the
// SavedItemCard renders it without changes. Once we ship a real
// ReservationCard component this projection goes away.
function toSavedItem(r: Reservation): SavedItem {
  const when = formatWhen(r.date, r.time);
  return {
    id: r.id,
    venueId: r.venueId,
    steps: ["R", "P", "C"],
    badgeTone: "pink",
    state: "arrive",
    totalDots: 7,
    doneDots: 0,
    cashback: null,
    when,
    partySize: r.partySize,
    cashbackCap: undefined,
    reservationStatus: "confirmed",
  };
}

function formatWhen(iso: string, time: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
  const month = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ][dt.getMonth()];
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const min = Number(mStr);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  const minPart = min === 0 ? "" : `:${String(min).padStart(2, "0")}`;
  return `${weekday} ${month} ${d} · ${h12}${minPart} ${period}`;
}
