"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isTicketFlowComplete,
  resolveTicketFlowSteps,
  STEP_NOW_TITLE,
  ticketProgressFromBundle,
} from "@/lib/ticket-flow-steps";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { TicketVisitShell } from "@/components/consumer/TicketVisitShell";
import {
  buildTicketTransactionSummary,
  formatTicketRewardLabel,
  formatTicketVisitDate,
  payloadFromNotification,
  type PayNotificationRow,
  type TicketBillPayload,
} from "@/lib/api/pay";
import { ticketPath } from "@/lib/consumer-route-contract";
import {
  fetchPayTicketList,
  type PayTicketMeta,
} from "@/lib/api/notifications";
import { usePayNotificationPoll } from "@/lib/hooks/usePayNotificationPoll";
import { TicketCardSkeleton } from "@/app/(shell)/pay/PayTabLoading";

type TicketBundle = {
  ticketId: string;
  payload: TicketBillPayload;
  bill?: PayNotificationRow;
  review?: PayNotificationRow;
};

type TicketMeta = PayTicketMeta;

function TicketPreviewCard({
  bundle,
  ticketMeta,
  onOpen,
}: {
  bundle: TicketBundle;
  ticketMeta?: TicketMeta;
  onOpen: () => void;
}) {
  const p = bundle.payload;
  const enriched: TicketBillPayload = {
    ...p,
    discount_percent: p.discount_percent ?? ticketMeta?.discount_percent,
  };
  const capMxn =
    p.reward_cap_mxn ?? p.monthly_promo_cap ?? ticketMeta?.capMxn ?? null;
  const ticketKind = ticketMeta?.kind ?? p.ticket_kind ?? "dp";
  const progress = ticketProgressFromBundle({
    kind: ticketKind,
    status: ticketMeta?.status,
    story_status: ticketMeta?.story_status,
    story_submitted_at: ticketMeta?.story_submitted_at,
    total_cents: ticketMeta?.total_cents ?? p.total_cents,
    review: bundle.review,
  });
  const flowSteps = resolveTicketFlowSteps(progress);
  const isComplete = isTicketFlowComplete(progress);
  const transactionSummary = isComplete
    ? buildTicketTransactionSummary(enriched, ticketKind)
    : null;
  const activeStep = flowSteps.find((s) => s.state === "active");
  const statusLine =
    isComplete || !activeStep
      ? null
      : `${STEP_NOW_TITLE[activeStep.id]} — in progress`;
  const visitDateIso =
    ticketMeta?.created_at ??
    bundle.bill?.created_at ??
    bundle.review?.created_at ??
    null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left transition active:scale-[0.995]"
    >
      <TicketVisitShell
        placeName={p.place_name ?? "Partner place"}
        placePhotoUrl={p.place_photo_url}
        rewardLabel={formatTicketRewardLabel(enriched, { capMxn })}
        visitDateLabel={formatTicketVisitDate(visitDateIso)}
        steps={flowSteps}
        stepperInteractive={false}
        transactionSummary={transactionSummary}
        statusLine={statusLine}
      />
    </button>
  );
}

/** Tickets from Pay notifications — open + completed history. */
export function PayTickets({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [rows, setRows] = useState<PayNotificationRow[]>([]);
  const [ticketMetaById, setTicketMetaById] = useState<Map<string, TicketMeta>>(
    new Map(),
  );
  // "loading" until the FIRST fetch settles — the real empty-state copy must
  // never flash while the request is still in flight. After a successful
  // load, a failed poll tick keeps the last known list ("ready") instead of
  // wiping it; the error panel is only for "we have nothing real to show".
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

  // Initial load: run the fetch inline in the effect body (cancellation
  // guarded) so setState isn't called synchronously on mount.
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
    return [...map.values()];
  }, [rows]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h2 className="text-foreground text-sm font-semibold">Tickets</h2>
        <p className="text-muted-foreground text-[11px]">Open + completed</p>
      </div>

      {status === "loading" ? (
        <>
          <TicketCardSkeleton />
          <TicketCardSkeleton />
        </>
      ) : status === "error" ? (
        <div className="border-destructive/30 bg-destructive/5 rounded-2xl border px-4 py-6 text-center">
          <p className="text-destructive text-sm font-semibold">
            Couldn&apos;t load your tickets.
          </p>
          <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
            Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={retry}
            className="border-border bg-card hover:bg-muted mt-4 rounded-lg border px-5 py-2 text-sm font-semibold transition"
          >
            Retry
          </button>
        </div>
      ) : bundles.length === 0 ? (
        <p className="surface-card text-muted-foreground px-4 py-8 text-center text-sm leading-relaxed">
          When staff opens your ticket at the table, it appears here with the
          place photo, your total reward, and steps to finish. Completed tickets
          stay here as history.
        </p>
      ) : (
        bundles.map((b) => (
          <TicketPreviewCard
            key={b.ticketId}
            bundle={b}
            ticketMeta={ticketMetaById.get(b.ticketId)}
            onOpen={() =>
              router.push(ticketPath(b.ticketId), { scroll: false })
            }
          />
        ))
      )}
    </section>
  );
}
