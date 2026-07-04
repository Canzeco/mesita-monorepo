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

  const loadTickets = useCallback(async () => {
    try {
      const { notifications, ticketMetaById } = await fetchPayTicketList(
        supabase,
      );
      setRows(notifications);
      setTicketMetaById(ticketMetaById);
    } catch {
      setRows([]);
      setTicketMetaById(new Map());
    }
  }, [supabase]);

  useEffect(() => {
    void loadTickets();
    const channel = supabase
      .channel(`pay-tickets:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "consumer_pay_notifications",
          filter: `consumer_id=eq.${userId}`,
        },
        () => {
          void loadTickets();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, loadTickets]);

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

      {bundles.length === 0 ? (
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
