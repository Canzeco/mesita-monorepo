"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ACTIVE_TICKET_STATUSES,
  apiListConsumerTickets,
  type ConsumerTicketRow,
} from "@/lib/api/tickets";
import { usePayNotificationPoll } from "@/lib/hooks/usePayNotificationPoll";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// Tickets v2 (MESITA-806): the ticket-driven source behind the Rewards
// New/History tabs and the pass LiveStrip. One fetch + the shared poll
// cadence; New/History split client-side so a status change moves a card
// across tabs without a refetch.

type ConsumerTicketsState = {
  active: ConsumerTicketRow[];
  history: ConsumerTicketRow[];
  status: "loading" | "ready" | "error";
  refresh: () => Promise<void>;
  retry: () => void;
};

export function useConsumerTickets(userId: string): ConsumerTicketsState {
  const supabase = useBrowserSupabase();
  const [rows, setRows] = useState<ConsumerTicketRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

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
        if (!cancelled)
          setStatus((prev) => (prev === "ready" ? prev : "error"));
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
