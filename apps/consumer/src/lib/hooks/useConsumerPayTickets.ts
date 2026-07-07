"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isTicketFlowComplete,
  resolveTicketFlowSteps,
  ticketFlowTypeFromKind,
  ticketProgressFromBundle,
  type TicketFlowStepView,
} from "@/lib/ticket-flow-steps";
import {
  formatTicketVisitDate,
  payloadFromNotification,
  type PayNotificationRow,
  type TicketBillPayload,
} from "@/lib/api/pay";
import {
  fetchPayTicketList,
  type PayTicketMeta,
} from "@/lib/api/notifications";
import { usePayNotificationPoll } from "@/lib/hooks/usePayNotificationPoll";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// One fetch, two consumers: the Rewards passport card (member stats) and the
// tickets list both read the same ticket bundles. This hook lifts the fetch +
// poll + bundle/sort out of PayTickets so the page fetches once and derives
// stats + the list from a single source.

export type TicketBundle = {
  ticketId: string;
  payload: TicketBillPayload;
  bill?: PayNotificationRow;
  review?: PayNotificationRow;
};

export type PayTicketsState = {
  bundles: TicketBundle[];
  ticketMetaById: Map<string, PayTicketMeta>;
  status: "loading" | "ready" | "error";
  retry: () => void;
};

export function useConsumerPayTickets(userId: string): PayTicketsState {
  const supabase = useBrowserSupabase();
  const [rows, setRows] = useState<PayNotificationRow[]>([]);
  const [ticketMetaById, setTicketMetaById] = useState<
    Map<string, PayTicketMeta>
  >(new Map());
  // "loading" until the FIRST fetch settles, so the real empty state never
  // flashes while the request is in flight. After a good load, a failed poll
  // keeps the last list ("ready") instead of wiping it.
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  const loadTickets = useCallback(async () => {
    try {
      const { notifications, ticketMetaById } =
        await fetchPayTicketList(supabase);
      setRows(notifications);
      setTicketMetaById(ticketMetaById);
      setStatus("ready");
    } catch {
      setStatus((prev) => (prev === "ready" ? prev : "error"));
    }
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { notifications, ticketMetaById } =
          await fetchPayTicketList(supabase);
        if (!cancelled) {
          setRows(notifications);
          setTicketMetaById(ticketMetaById);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setStatus((prev) => (prev === "ready" ? prev : "error"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  usePayNotificationPoll(loadTickets, Boolean(userId));

  const retry = useCallback(() => {
    setStatus("loading");
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
      if (n.kind === "bill") {
        b.bill = n;
        b.payload = { ...b.payload, ...payloadFromNotification(n.payload) };
      }
      if (n.kind === "review") {
        b.review = n;
        b.payload = { ...b.payload, ...payloadFromNotification(n.payload) };
      }
    }
    // Pure time sort, most recent first.
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

// ─── Derived views ──────────────────────────────────────────────────────────

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
    kind: meta?.kind ?? p.ticket_kind ?? "dp",
    status: meta?.status,
    story_status: meta?.story_status,
    story_submitted_at: meta?.story_submitted_at,
    total_cents: meta?.total_cents ?? p.total_cents,
    review: bundle.review,
  });
}

/** Ticket → compact card view: image, name, time, steps. */
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
    placeName: p.place_name ?? "Partner place",
    placePhotoUrl: p.place_photo_url,
    timeLabel: formatTicketVisitDate(visitDateIso) ?? "—",
    steps: resolveTicketFlowSteps(progressOf(bundle, meta)),
  };
}

// ─── Member stats (derived from the ticket list) ────────────────────────────

const STORY_VERIFIED = new Set(["ai_verified", "staff_verified"]);

export type RewardStats = {
  visits: number;
  savedCents: number;
  stories: number;
  reviews: number;
};

function rewardCentsOf(p: TicketBillPayload): number {
  return p.total_reward_cents ?? (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);
}

/**
 * Member scorecard, computed from the ticket bundles:
 * - Visits  — every ticket is one table visit.
 * - Saved   — reward summed over closed (completed) visits, where it's realized.
 * - Stories — Type-B visits whose Instagram story was verified.
 * - Reviews — visits with a completed review.
 */
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

    const kind = meta?.kind ?? b.payload.ticket_kind ?? "dp";
    if (
      ticketFlowTypeFromKind(kind) === "B" &&
      meta?.story_status &&
      STORY_VERIFIED.has(meta.story_status)
    ) {
      stories += 1;
    }
    if (b.review?.status === "completed") reviews += 1;
  }

  return { visits, savedCents, stories, reviews };
}
