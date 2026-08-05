"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarX } from "lucide-react";

import { ReservationDetailBody } from "@/components/consumer/ReservationDetailBody";
import { ReservationDetailModalShell } from "@/components/consumer/ReservationDetailModalShell";
import { LoadingFill } from "@/components/shared/Spinner";
import { apiListReservations } from "@/lib/api/reservations";
import type { ReservationItem } from "@/lib/mock/reservations-mock";
import { toReservationItem } from "@/lib/reservations-adapter";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { SHEET_TITLE_CLASS } from "@/lib/ui-classes";

type State =
  | { status: "loading" }
  | { status: "found"; r: ReservationItem }
  | { status: "missing" };

// consumer-web-list-reservations has no get-by-id, so the detail surface pulls
// the caller's full list once (scope "all") and finds the row. N is small — a
// single account rarely holds more than a handful of bookings.
function useReservationById(id: string): { state: State; reload: () => void } {
  const supabase = useBrowserSupabase();
  const [state, setState] = useState<State>({ status: "loading" });
  // Bumped by the detail actions (cancel / reschedule) so the ticket's phase,
  // banner and available actions re-derive from the server, not from guesses.
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { reservations } = await apiListReservations(supabase, {
          scope: "all",
          limit: 200,
        });
        const match = reservations.find((row) => row.id === id);
        if (!cancelled) {
          setState(
            match
              ? { status: "found", r: toReservationItem(match) }
              : { status: "missing" },
          );
        }
      } catch {
        if (!cancelled) setState({ status: "missing" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, id, nonce]);

  return { state, reload };
}

function ReservationNotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="bg-muted text-muted-foreground flex h-16 w-16 items-center justify-center rounded-2xl">
        <CalendarX className="h-7 w-7" strokeWidth={2} />
      </span>
      <div className="flex flex-col items-center gap-1.5">
        <h2 className={SHEET_TITLE_CLASS}>Reservation not found</h2>
        <p className="text-muted-foreground max-w-xs text-sm leading-snug">
          This reservation isn&apos;t on your account anymore. It may have been
          cancelled or booked from another number.
        </p>
      </div>
    </div>
  );
}

// Body for the hard-nav /reservation/[id] page — the page supplies its
// own header around this.
export function ReservationDetailFetcher({ id }: { id: string }) {
  const { state, reload } = useReservationById(id);
  if (state.status === "loading") {
    return <LoadingFill label="Loading reservation" />;
  }
  if (state.status === "missing") return <ReservationNotFound />;
  return <ReservationDetailBody r={state.r} onChanged={reload} />;
}

// Intercepted soft-nav modal: owns the slide-over shell so the place name is
// available for the share action once the row resolves.
export function ReservationDetailModalClient({ id }: { id: string }) {
  const { state, reload } = useReservationById(id);
  const placeName =
    state.status === "found" ? state.r.placeName : "your reservation";
  return (
    <ReservationDetailModalShell placeName={placeName}>
      {state.status === "loading" ? (
        <LoadingFill label="Loading reservation" />
      ) : state.status === "missing" ? (
        <ReservationNotFound />
      ) : (
        <ReservationDetailBody r={state.r} onChanged={reload} />
      )}
    </ReservationDetailModalShell>
  );
}
