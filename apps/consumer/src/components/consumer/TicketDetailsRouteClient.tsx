"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  buildTicketTransactionSummary,
  formatTicketRewardLabel,
  formatTicketVisitDate,
  payloadFromNotification,
  mockStoryDetect,
  MOCK_STORY_DETECT_ENABLED,
  resolvePlaceInstagramHandle,
  submitTicketReview,
  type PayNotificationRow,
  type TicketBillPayload,
} from "@/lib/api/pay";
import { TicketDetailsSkeleton } from "@/components/consumer/TicketDetailsSkeleton";
import { TicketDetailsView } from "@/components/consumer/TicketDetailsView";
import { errMsg } from "@/lib/utils";
import { placeHref } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import {
  isTicketFlowComplete,
  ticketProgressFromBundle,
} from "@/lib/ticket-flow-steps";

export function TicketDetailsRouteClient({
  userId,
  ticketId,
  variant = "page",
}: {
  userId: string;
  ticketId: string;
  variant?: "page" | "modal";
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [rows, setRows] = useState<PayNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketMeta, setTicketMeta] = useState<{
    kind?: string;
    status?: string;
    story_status?: string;
    story_submitted_at?: string | null;
    total_cents?: number | null;
    created_at?: string | null;
  } | null>(null);
  const [placeInstagramUrl, setPlaceInstagramUrl] = useState<string | null>(
    null,
  );
  const [reviewDraft, setReviewDraft] = useState({
    food: 0,
    service: 0,
    ambiance: 0,
    value: 0,
    overall: 0,
    comments: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: qErr } = await supabase
      .from("consumer_pay_notifications")
      .select("*")
      .eq("consumer_id", userId)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false });
    if (qErr) {
      setError(errMsg(qErr, "Couldn't load ticket."));
      setLoading(false);
      return;
    }
    setRows(data ?? []);

    const { data: ticketRow } = await supabase
      .from("tickets")
      .select(
        "kind, status, story_status, story_submitted_at, total_cents, created_at",
      )
      .eq("id", ticketId)
      .maybeSingle();
    setTicketMeta(ticketRow ?? null);

    const projectId =
      (data ?? [])
        .map((r) => payloadFromNotification(r.payload).project_id)
        .find(Boolean) ?? null;
    if (projectId) {
      const { data: placeRow } = await supabase
        .from("places")
        .select("instagram_url")
        .eq("id", projectId)
        .maybeSingle();
      setPlaceInstagramUrl(placeRow?.instagram_url ?? null);
    } else {
      setPlaceInstagramUrl(null);
    }

    setLoading(false);
  }, [supabase, userId, ticketId]);

  useEffect(() => {
    void load();
  }, [load, ticketId]);

  const payload = useMemo<TicketBillPayload>(() => {
    const merged: TicketBillPayload = {};
    for (const row of rows)
      Object.assign(merged, payloadFromNotification(row.payload));
    return merged;
  }, [rows]);

  const ticketKind = ticketMeta?.kind ?? payload.ticket_kind ?? "dp";
  const billNotification = rows.find((r) => r.kind === "bill");
  const reviewNotification = rows.find((r) => r.kind === "review");

  const transactionSummary = useMemo(() => {
    const progress = ticketProgressFromBundle({
      kind: ticketKind,
      status: ticketMeta?.status,
      story_status: ticketMeta?.story_status,
      total_cents: ticketMeta?.total_cents ?? payload.total_cents,
      review: reviewNotification,
    });
    return isTicketFlowComplete(progress)
      ? buildTicketTransactionSummary(payload, ticketKind)
      : null;
  }, [ticketKind, ticketMeta, payload, reviewNotification]);

  const visitDateIso =
    ticketMeta?.created_at ??
    billNotification?.created_at ??
    rows[0]?.created_at ??
    null;
  const placeName = payload.place_name ?? "Partner place";
  const visitDateLabel = formatTicketVisitDate(visitDateIso);
  const placeLink = payload.place_slug
    ? placeHref(payload.place_slug)
    : payload.project_id
      ? placeHref(payload.project_id)
      : null;
  const capMxn = payload.reward_cap_mxn ?? payload.monthly_promo_cap ?? null;
  const rewardLabel = formatTicketRewardLabel(payload, { capMxn });
  const placeInstagramHandle = useMemo(
    () => resolvePlaceInstagramHandle(payload, placeInstagramUrl),
    [payload, placeInstagramUrl],
  );

  const onMockStoryDetect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await mockStoryDetect(supabase, ticketId);
      await load();
    } catch (e) {
      setError(errMsg(e, "Couldn't simulate story detection."));
    } finally {
      setBusy(false);
    }
  }, [supabase, ticketId, load]);

  const onReview = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await submitTicketReview(supabase, {
        ticketId,
        ...reviewDraft,
        comments: reviewDraft.comments.trim() || undefined,
      });
      await load();
    } catch (e) {
      setError(errMsg(e, "Couldn't submit review."));
    } finally {
      setBusy(false);
    }
  }, [supabase, ticketId, reviewDraft, load]);

  const onBack = () => {
    if (variant === "modal") router.back();
    else router.push(CONSUMER_ROUTES.pay.tickets);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {variant === "page" ? (
        <div className="flex items-center gap-2 px-4 pt-3">
          <button
            type="button"
            onClick={onBack}
            className="surface-card text-foreground rounded-full p-2"
            aria-label="Back to tickets"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-foreground text-sm font-semibold">Your visit</p>
        </div>
      ) : null}

      <div
        className={
          variant === "page"
            ? "scrollbar-always min-h-0 flex-1 overflow-y-scroll px-3 pt-3 pb-6"
            : "scrollbar-always min-h-0 flex-1 overflow-y-scroll px-4 pt-3 pb-8"
        }
      >
        {loading ? (
          <TicketDetailsSkeleton />
        ) : (
          <TicketDetailsView
            ticketKind={ticketKind}
            payload={payload}
            capMxn={capMxn}
            placeName={placeName}
            visitDateLabel={visitDateLabel}
            placeHref={placeLink}
            rewardLabel={rewardLabel}
            ticketMeta={ticketMeta}
            review={reviewNotification}
            transactionSummary={transactionSummary}
            reviewDraft={reviewDraft}
            onReviewDraftChange={setReviewDraft}
            busy={busy}
            error={error}
            onSubmitReview={() => void onReview()}
            onMockStoryDetect={() => void onMockStoryDetect()}
            showMockStoryButton={MOCK_STORY_DETECT_ENABLED}
            placeInstagramHandle={placeInstagramHandle}
          />
        )}
      </div>
    </div>
  );
}
