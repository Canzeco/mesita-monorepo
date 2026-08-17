"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { EFError } from "@/lib/api/_invoke";
import {
  ACTIVE_TICKET_STATUSES,
  apiCreateTicket,
  apiGetRewardQuote,
  apiListConsumerTickets,
  type ConsumerTicketRow,
} from "@/lib/api/tickets";
import { seedTicket, ticketRowFromCreate, type SeedPlace } from "@/lib/ticket-seed";
import { ticketPath } from "@/lib/consumer-route-contract";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// Starting a visit, extracted (MESITA-1065). This was RewardsClient's private
// `startTicket`/`onPick` pair until the place-detail action bar grew a Visit
// button and needed the identical contract. It is EXTRACTED, not copied: the
// flow spends money (a ticket is a discount the place will honor), carries a
// two-arm 409 race recovery, and seeds a cache another screen paints from —
// three things that must never drift between two surfaces.
//
// ONE TAP IS THE WHOLE INTERACTION. Every ticket is created at "base": no task
// attached, nothing gating the QR. The rung is picked afterwards inside THE
// TICKET and re-prices upward, because the submit-review / submit-story EFs
// accept any OPEN ticket. That is what lets the QR work from the first frame.

export type StartVisitState = {
  /** Create-or-open for this place. Safe to call from an onClick. */
  pickPlace: (place: SeedPlace) => void;
  /** Place id whose ticket is being created right now (spinner source). */
  startingId: string | null;
  error: string | null;
  clearError: () => void;
};

export function useStartVisit({
  activeTickets,
  onCreated,
}: {
  /** Live tickets, so a place that already holds one re-opens it (D5). */
  activeTickets: readonly ConsumerTicketRow[];
  /** Called after a successful create — callers refresh their ticket list. */
  onCreated?: () => void;
}): StartVisitState {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openTicket = useCallback(
    (id: string) => {
      router.push(ticketPath(id), { scroll: false });
    },
    [router],
  );

  const startTicket = useCallback(
    async (place: SeedPlace) => {
      setStartingId(place.id);
      setError(null);
      // The quote starts NOW, in parallel with the create (MESITA-1029 S4),
      // so step 1's numbers are ready at arrival instead of after two chained
      // fetches on the ticket screen. Resolves null on failure — the screen
      // falls back to its own fetch + retry.
      const quotePromise = apiGetRewardQuote(supabase, place.id)
        .then((r) => r.quote)
        .catch(() => null);
      try {
        const res = await apiCreateTicket(supabase, place.id, "base");
        // Seed BEFORE navigating (S3): THE TICKET paints QR-and-all on its
        // first frame from this row; list-tickets reconciles in background.
        seedTicket(ticketRowFromCreate(res.ticket, place), quotePromise);
        onCreated?.();
        router.push(ticketPath(res.ticket.id), { scroll: false });
      } catch (err) {
        if (err instanceof EFError && err.code === "already_open") {
          // Another device/tab won the race — open the existing ticket. The
          // friendly 409 carries its id; the index-race arm doesn't, so fall
          // back to a fresh list (never the stale closure state).
          const fromBody = err.body?.ticketId;
          let id = typeof fromBody === "string" ? fromBody : null;
          if (!id) {
            const rows = await apiListConsumerTickets(supabase).catch(
              () => [] as ConsumerTicketRow[],
            );
            id =
              rows.find(
                (t) =>
                  t.project_id === place.id &&
                  ACTIVE_TICKET_STATUSES.has(t.status),
              )?.id ?? null;
          }
          if (id) {
            openTicket(id);
            return;
          }
        }
        setError(
          err instanceof Error ? err.message : "Couldn't start your ticket.",
        );
      } finally {
        setStartingId(null);
      }
    },
    [supabase, router, openTicket, onCreated],
  );

  const pickPlace = useCallback(
    (place: SeedPlace) => {
      const existing = activeTickets.find((t) => t.project_id === place.id);
      if (existing) {
        // Live ticket → open it rather than making a second one (D5).
        openTicket(existing.id);
        return;
      }
      void startTicket(place);
    },
    [activeTickets, openTicket, startTicket],
  );

  const clearError = useCallback(() => setError(null), []);

  return { pickPlace, startingId, error, clearError };
}
