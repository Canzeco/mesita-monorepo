"use client";

import { useMemo, useState } from "react";
import { ReservationCard } from "@/components/consumer/ReservationCard";
import { CalendarConnectBox } from "./CalendarConnectBox";
import { WhatsAppRemindersBox } from "./WhatsAppRemindersBox";
import {
  MOCK_RESERVATIONS,
  type ReservationItem,
} from "@/lib/mock/reservations-mock";
import { cn } from "@/lib/utils";

// Top-level Reservations surface. Booking entries only — no money,
// no cashback, no ticket-style step dots. The companion coupon (if any)
// lives in /coupons.
//
// Lifecycle pills: booking · booked · cancelled. The list filter
// matches one bucket at a time:
//
//   Upcoming   booking + booked (anything still actionable)
//   Past       any cancelled / completed
//   Cancelled  cancelled only

export const dynamic = "force-dynamic";

type Filter = "upcoming" | "past" | "cancelled";

export default function ReservationsPage() {
  const [filter, setFilter] = useState<Filter>("upcoming");

  const items = useMemo<ReservationItem[]>(() => {
    if (filter === "upcoming") {
      return MOCK_RESERVATIONS.filter(
        (r) => r.status === "booking" || r.status === "booked",
      );
    }
    if (filter === "cancelled") {
      return MOCK_RESERVATIONS.filter((r) => r.status === "cancelled");
    }
    return MOCK_RESERVATIONS.filter((r) => r.status === "cancelled"); // "past" stub
  }, [filter]);

  const counts = useMemo(() => {
    return {
      upcoming: MOCK_RESERVATIONS.filter(
        (r) => r.status === "booking" || r.status === "booked",
      ).length,
      past: 0,
      cancelled: MOCK_RESERVATIONS.filter((r) => r.status === "cancelled")
        .length,
    };
  }, []);

  // Flex column with three shrink-0 top regions (preview banner,
  // calendar/reminders card, filter pills) and a scrollable list at the
  // bottom. The list needs both `flex-1` AND `min-h-0` — without
  // `min-h-0`, the flex child defaults to min-content sizing and never
  // clips, so `overflow-y-auto` has nothing to scroll.
  return (
    <div className="relative flex h-full flex-col">
      <div className="shrink-0 px-4 pt-3">
        <p className="bg-secondary/10 text-secondary rounded-xl px-3 py-2 text-[11px]">
          Preview — reservations aren&apos;t connected to the backend yet.
        </p>
      </div>

      <div className="shrink-0 px-4 pt-3">
        <div className="border-border bg-card-soft divide-border/70 divide-y overflow-hidden rounded-2xl border">
          <CalendarConnectBox />
          <WhatsAppRemindersBox />
        </div>
      </div>

      <div className="shrink-0 px-4 pt-4">
        <div className="border-border bg-card scrollbar-hide flex gap-1 overflow-x-auto rounded-full border p-1">
          {(
            [
              { id: "upcoming", label: "Upcoming", count: counts.upcoming },
              { id: "past", label: "Past", count: counts.past },
              {
                id: "cancelled",
                label: "Cancelled",
                count: counts.cancelled,
              },
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

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {items.length === 0 ? (
          <EmptyState
            label={
              filter === "upcoming"
                ? "Nothing booked yet. Tap a venue to reserve."
                : filter === "past"
                  ? "No past reservations yet."
                  : "No cancelled reservations."
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((r) => (
              <ReservationCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </div>
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
