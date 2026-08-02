"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ACTIVE_TICKET_STATUSES,
  apiListConsumerTickets,
  type ConsumerTicketRow,
} from "@/lib/api/tickets";
import type { PassTicketView } from "@/lib/hooks/useConsumerPayTickets";
import { usePayNotificationPoll } from "@/lib/hooks/usePayNotificationPoll";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// Tickets v2 (MESITA-806): the ticket-driven source behind the Rewards
// New/History tabs and the pass LiveStrip. One fetch + the shared poll
// cadence; New/History split client-side so a status change moves a card
// across tabs without a refetch.

export type ConsumerTicketsState = {
  active: ConsumerTicketRow[];
  history: ConsumerTicketRow[];
  status: "loading" | "ready" | "error";
  refresh: () => Promise<void>;
  retry: () => void;
};

export function useConsumerTickets(userId: string): ConsumerTicketsState {
  const supabase = useBrowserSupabase();
  const [rows, setRows] = useState<ConsumerTicketRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const refresh = useCallback(async () => {
    try {
      const tickets = await apiListConsumerTickets(supabase);
      setRows(tickets);
      setStatus("ready");
    } catch {
      setStatus((prev) => (prev === "ready" ? prev : "error"));
    }
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tickets = await apiListConsumerTickets(supabase);
        if (!cancelled) {
          setRows(tickets);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus((prev) => (prev === "ready" ? prev : "error"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  usePayNotificationPoll(refresh, Boolean(userId));

  const retry = useCallback(() => {
    setStatus("loading");
    void refresh();
  }, [refresh]);

  const { active, history } = useMemo(() => {
    const active: ConsumerTicketRow[] = [];
    const history: ConsumerTicketRow[] = [];
    for (const row of rows) {
      // The list is reward tickets only — reservation-kind rows have their
      // own tab and never carry a check_code.
      if (row.kind === "reservation") continue;
      (ACTIVE_TICKET_STATUSES.has(row.status) ? active : history).push(row);
    }
    return { active, history };
  }, [rows]);

  return { active, history, status, refresh, retry };
}

// Story lifecycle → the one line the pass needs (ticket-driven twin of the
// old notification-derived derivePassTicket).
const STORY_PENDING_LABEL: Record<string, string> = {
  pending: "Post your story to unlock it",
  submitted: "Story sent — waiting on the place",
  ai_rejected: "Story wasn't accepted — ask the staff",
  staff_rejected: "Story wasn't accepted — ask the staff",
};

export function derivePassTicketFromRows(
  active: ConsumerTicketRow[],
): PassTicketView | null {
  const t = active[0];
  if (!t) return null;
  return {
    ticketId: t.id,
    placeName: t.place?.name ?? "Partner place",
    discountPercent: t.discount_percent,
    pendingLabel: t.story_status
      ? (STORY_PENDING_LABEL[t.story_status] ?? null)
      : null,
  };
}
