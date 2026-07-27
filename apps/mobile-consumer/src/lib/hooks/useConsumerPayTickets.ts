import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  formatTicketVisitDate,
  payloadFromNotification,
  type PayNotificationRow,
  type TicketBillPayload,
} from '@/lib/api/pay';
import {
  fetchPayTicketList,
  type PayTicketMeta,
} from '@/lib/api/notifications';
import { usePayNotificationPoll } from '@/lib/hooks/usePayNotificationPoll';
import {
  isTicketFlowComplete,
  resolveTicketFlowSteps,
  ticketFlowTypeFromKind,
  ticketProgressFromBundle,
  type TicketFlowStepView,
} from '@/lib/ticket-flow-steps';

type TicketBundle = {
  ticketId: string;
  payload: TicketBillPayload;
  bill?: PayNotificationRow;
  review?: PayNotificationRow;
};

export type PayTicketsState = {
  bundles: TicketBundle[];
  ticketMetaById: Map<string, PayTicketMeta>;
  status: 'loading' | 'ready' | 'error';
  retry: () => void;
};

export function useConsumerPayTickets(userId: string): PayTicketsState {
  const [rows, setRows] = useState<PayNotificationRow[]>([]);
  const [ticketMetaById, setTicketMetaById] = useState<
    Map<string, PayTicketMeta>
  >(new Map());
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  const loadTickets = useCallback(async () => {
    try {
      const { notifications, ticketMetaById: meta } =
        await fetchPayTicketList();
      setRows(notifications);
      setTicketMetaById(meta);
      setStatus('ready');
    } catch {
      setStatus((prev) => (prev === 'ready' ? prev : 'error'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { notifications, ticketMetaById: meta } =
          await fetchPayTicketList();
        if (!cancelled) {
          setRows(notifications);
          setTicketMetaById(meta);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) {
          setStatus((prev) => (prev === 'ready' ? prev : 'error'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  usePayNotificationPoll(loadTickets, Boolean(userId));

  const retry = useCallback(() => {
    setStatus('loading');
    void loadTickets();
  }, [loadTickets]);

  const bundles = useMemo(() => {
    const map = new Map<string, TicketBundle>();
    for (const n of rows) {
      let b = map.get(n.ticket_id);
      if (!b) {
        b = {
          ticketId: n.ticket_id,
          payload: payloadFromNotification(n.payload),
        };
        map.set(n.ticket_id, b);
      }
      if (n.kind === 'bill') {
        b.bill = n;
        b.payload = { ...b.payload, ...payloadFromNotification(n.payload) };
      }
      if (n.kind === 'review') {
        b.review = n;
        b.payload = { ...b.payload, ...payloadFromNotification(n.payload) };
      }
    }
    const timeOf = (b: TicketBundle): number => {
      const iso =
        ticketMetaById.get(b.ticketId)?.created_at ??
        b.bill?.created_at ??
        b.review?.created_at ??
        null;
      return iso ? new Date(iso).getTime() : 0;
    };
    return [...map.values()].sort((a, b) => timeOf(b) - timeOf(a));
  }, [rows, ticketMetaById]);

  return { bundles, ticketMetaById, status, retry };
}

export type TicketCardView = {
  ticketId: string;
  placeName: string;
  placePhotoUrl?: string | null;
  timeLabel: string;
  steps: TicketFlowStepView[];
};

function progressOf(bundle: TicketBundle, meta?: PayTicketMeta) {
  const p = bundle.payload;
  return ticketProgressFromBundle({
    kind: meta?.kind ?? p.ticket_kind ?? 'dp',
    status: meta?.status,
    story_status: meta?.story_status,
    story_submitted_at: meta?.story_submitted_at,
    total_cents: meta?.total_cents ?? p.total_cents,
    review: bundle.review,
  });
}

export function bundleToCardView(
  bundle: TicketBundle,
  meta?: PayTicketMeta,
): TicketCardView {
  const p = bundle.payload;
  const visitDateIso =
    meta?.created_at ??
    bundle.bill?.created_at ??
    bundle.review?.created_at ??
    null;
  return {
    ticketId: bundle.ticketId,
    placeName: p.place_name ?? 'Partner place',
    placePhotoUrl: p.place_photo_url,
    timeLabel: formatTicketVisitDate(visitDateIso) ?? '—',
    steps: resolveTicketFlowSteps(progressOf(bundle, meta)),
  };
}

const STORY_VERIFIED = new Set(['ai_verified', 'staff_verified']);

export type RewardStats = {
  visits: number;
  savedCents: number;
  stories: number;
  reviews: number;
};

function rewardCentsOf(p: TicketBillPayload): number {
  return p.total_reward_cents ?? (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);
}

export function computeRewardStats(
  bundles: TicketBundle[],
  ticketMetaById: Map<string, PayTicketMeta>,
): RewardStats {
  let visits = 0;
  let savedCents = 0;
  let stories = 0;
  let reviews = 0;

  for (const b of bundles) {
    const meta = ticketMetaById.get(b.ticketId);
    const progress = progressOf(b, meta);
    const complete = isTicketFlowComplete(progress);

    visits += 1;
    if (complete) savedCents += rewardCentsOf(b.payload);

    const kind = meta?.kind ?? b.payload.ticket_kind ?? 'dp';
    if (
      ticketFlowTypeFromKind(kind) === 'B' &&
      meta?.story_status &&
      STORY_VERIFIED.has(meta.story_status)
    ) {
      stories += 1;
    }
    if (b.review?.status === 'completed') reviews += 1;
  }

  return { visits, savedCents, stories, reviews };
}
