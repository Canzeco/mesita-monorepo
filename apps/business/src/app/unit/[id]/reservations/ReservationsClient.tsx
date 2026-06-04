"use client";

import { useState } from "react";
import { CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiDecideReservation,
  apiListReservations,
  type BusinessReservation,
  type ReservationScope,
} from "@/lib/api/reservations";
import { cn, errMsg } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { EmptyState } from "@/components/shared";
import { ReservationCard } from "@/components/reservations/ReservationCard";

const SCOPES: { key: ReservationScope; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
];

// Bookings the live "upcoming" view should keep showing after an action.
const UPCOMING_STATES = new Set(["pending", "confirmed"]);

export function ReservationsClient({
  venueId,
  initialReservations,
}: {
  venueId: string;
  initialReservations: BusinessReservation[];
}) {
  const supabase = useBrowserSupabase();
  const [scope, setScope] = useState<ReservationScope>("upcoming");
  const [reservations, setReservations] =
    useState<BusinessReservation[]>(initialReservations);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = reservations.filter(
    (r) => r.status === "pending",
  ).length;

  async function load(nextScope: ReservationScope) {
    setBusy("refresh");
    setError(null);
    try {
      const rows = await apiListReservations(supabase, {
        venueId,
        scope: nextScope,
      });
      setReservations(rows);
    } catch (err) {
      setError(errMsg(err, "Couldn't load reservations."));
    } finally {
      setBusy(null);
    }
  }

  function switchScope(next: ReservationScope) {
    if (next === scope) return;
    setScope(next);
    void load(next);
  }

  async function onDecide(
    reservationId: string,
    decision: "confirm" | "decline",
  ) {
    setBusy(`${decision}:${reservationId}`);
    setError(null);
    try {
      const { reservation } = await apiDecideReservation(supabase, {
        venueId,
        reservationId,
        decision,
      });
      setReservations((prev) =>
        prev
          .map((r) => (r.id === reservation.id ? reservation : r))
          // Declines drop out of the live "upcoming" view immediately.
          .filter(
            (r) => scope !== "upcoming" || UPCOMING_STATES.has(r.status),
          ),
      );
    } catch (err) {
      setError(errMsg(err, "Couldn't update the reservation."));
    } finally {
      setBusy(null);
    }
  }

  const refreshing = busy === "refresh";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="bg-muted/60 inline-flex rounded-full p-0.5">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => switchScope(s.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition",
                scope === s.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
              {s.key === "upcoming" && pendingCount > 0 ? (
                <span className="bg-amber-500/15 text-amber-900 rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
                  {pendingCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => load(scope)}
          disabled={refreshing}
          aria-label="Refresh"
          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      {error ? <div className={ERROR_BOX_CLASS}>{error}</div> : null}

      {reservations.length === 0 && !refreshing ? (
        <EmptyState
          icon={<CalendarClock className="text-muted-foreground h-5 w-5" />}
          title={
            scope === "upcoming" ? "No upcoming reservations" : "Nothing here yet"
          }
          description={
            scope === "upcoming"
              ? "New bookings from Mesita land here. Confirm or decline each one."
              : "Past declined, cancelled, and no-show bookings will show here."
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {reservations.map((r) => (
            <ReservationCard
              key={r.id}
              reservation={r}
              busy={busy}
              onDecide={onDecide}
            />
          ))}
        </div>
      )}
    </div>
  );
}
