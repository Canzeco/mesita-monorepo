// Tickets v2 (MESITA-806) — ticket-driven source behind the Rewards
// New/History tabs and the pass LiveStrip. Mirror of the web hook.

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ACTIVE_TICKET_STATUSES,
  apiListConsumerTickets,
  type ConsumerTicketRow,
} from '@/lib/api/tickets';
import { usePayNotificationPoll } from '@/lib/hooks/usePayNotificationPoll';

export type ConsumerTicketsState = {
  active: ConsumerTicketRow[];
  history: ConsumerTicketRow[];
  status: 'loading' | 'ready' | 'error';
  refresh: () => Promise<void>;
  retry: () => void;
};

export function useConsumerTickets(userId: string): ConsumerTicketsState {
  const [rows, setRows] = useState<ConsumerTicketRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const refresh = useCallback(async () => {
    try {
      const tickets = await apiListConsumerTickets();
      setRows(tickets);
      setStatus('ready');
    } catch {
      setStatus((prev) => (prev === 'ready' ? prev : 'error'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tickets = await apiListConsumerTickets();
        if (!cancelled) {
          setRows(tickets);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus((prev) => (prev === 'ready' ? prev : 'error'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  usePayNotificationPoll(refresh, Boolean(userId));

  const retry = useCallback(() => {
    setStatus('loading');
    void refresh();
  }, [refresh]);

  const { active, history } = useMemo(() => {
    const active: ConsumerTicketRow[] = [];
    const history: ConsumerTicketRow[] = [];
    for (const row of rows) {
      // NOTE: there is no reservation row to skip. Reservations are their own
      // table (reservation_tickets); the ticket discriminator that once
      // claimed otherwise was born dead and has since been dropped.
      (ACTIVE_TICKET_STATUSES.has(row.status) ? active : history).push(row);
    }
    return { active, history };
  }, [rows]);

  return { active, history, status, refresh, retry };
}
