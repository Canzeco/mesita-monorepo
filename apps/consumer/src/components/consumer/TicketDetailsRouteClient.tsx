"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  confirmTicketPayment,
  buildTicketTransactionSummary,
  formatTicketRewardLabel,
  formatTicketVisitDate,
  payloadFromNotification,
  mockStoryDetect,
  MOCK_STORY_DETECT_ENABLED,
  resolveVenueInstagramHandle,
  submitTicketReview,
  type PayNotificationRow,
  type TicketBillPayload,
} from "@/lib/api/pay";
import { TicketDetailsSkeleton } from "@/components/consumer/TicketDetailsSkeleton";
import { TicketDetailsView } from "@/components/consumer/TicketDetailsView";
import { errMsg } from "@/lib/utils";
import { placeHref } from "@/lib/place-route";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { isTicketFlowComplete, ticketProgressFromBundle } from "@/lib/ticket-flow-steps";

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
  const searchParams = useSearchParams();
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
    consumer_payment_confirmed_at?: string | null;
    staff_payment_confirmed_at?: string | null;
    created_at?: string | null;
  } | null>(null);
  const [venueInstagramUrl, setVenueInstagramUrl] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState({
    food: 5,
    service: 5,
    ambiance: 5,
    overall: 5,
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
        "kind, status, story_status, story_submitted_at, total_cents, consumer_payment_confirmed_at, staff_payment_confirmed_at, created_at",
      )
      .eq("id", ticketId)
      .maybeSingle();
    setTicketMeta(ticketRow ?? null);

    const venueId =
      (data ?? []).map((r) => payloadFromNotification(r.payload).venue_id).find(Boolean) ??
      null;
    if (venueId) {
      const { data: venueRow } = await supabase
        .from("venues")
        .select("instagram_url")
        .eq("id", venueId)
        .maybeSingle();
      setVenueInstagramUrl(venueRow?.instagram_url ?? null);
    } else {
      setVenueInstagramUrl(null);
    }

    setLoading(false);
  }, [supabase, userId, ticketId]);

  useEffect(() => {
    void load();
  }, [load, ticketId]);

  useEffect(() => {
    if (searchParams.get("stripe_return") === "1") {
      void load();
      router.replace(`/pay/ticket/${ticketId}`, { scroll: false });
    }
  }, [searchParams, load, ticketId, router]);

  const paymentReturnUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/pay/ticket/${ticketId}?stripe_return=1`;
  }, [ticketId]);

  const payload = useMemo<TicketBillPayload>(() => {
    const merged: TicketBillPayload = {};
    for (const row of rows) Object.assign(merged, payloadFromNotification(row.payload));
    return merged;
  }, [rows]);

  const ticketKind = ticketMeta?.kind ?? payload.ticket_kind ?? "dp";
  const paymentNotification = rows.find((r) => r.kind === "payment_confirm");
  const reviewNotification = rows.find((r) => r.kind === "review");

  const transactionSummary = useMemo(() => {
    const progress = ticketProgressFromBundle({
      kind: ticketKind,
      status: ticketMeta?.status,
      story_status: ticketMeta?.story_status,
      total_cents: ticketMeta?.total_cents ?? payload.total_cents,
      consumer_payment_confirmed_at: ticketMeta?.consumer_payment_confirmed_at,
      staff_payment_confirmed_at: ticketMeta?.staff_payment_confirmed_at,
      payment: paymentNotification,
      review: reviewNotification,
    });
    return isTicketFlowComplete(progress)
      ? buildTicketTransactionSummary(payload, ticketKind)
      : null;
  }, [
    ticketKind,
    ticketMeta,
    payload,
    paymentNotification,
    reviewNotification,
  ]);

  const visitDateIso =
    ticketMeta?.created_at ??
    paymentNotification?.created_at ??
    rows[0]?.created_at ??
    null;
  const venueName = payload.venue_name ?? "Partner venue";
  const visitDateLabel = formatTicketVisitDate(visitDateIso);
  const venueHref = payload.venue_slug
    ? placeHref(payload.venue_slug)
    : payload.venue_id
      ? placeHref(payload.venue_id)
      : null;
  const capMxn = payload.reward_cap_mxn ?? payload.monthly_promo_cap ?? null;
  const rewardLabel = formatTicketRewardLabel(payload, { capMxn });
  const venueInstagramHandle = useMemo(
    () => resolveVenueInstagramHandle(payload, venueInstagramUrl),
    [payload, venueInstagramUrl],
  );

  const onConfirm = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmTicketPayment(supabase, ticketId);
      await load();
    } catch (e) {
      setError(errMsg(e, "Couldn't confirm payment."));
    } finally {
      setBusy(false);
    }
  }, [supabase, ticketId, load]);

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
            venueName={venueName}
            visitDateLabel={visitDateLabel}
            venueHref={venueHref}
            rewardLabel={rewardLabel}
            ticketMeta={ticketMeta}
            payment={paymentNotification}
            review={reviewNotification}
            transactionSummary={transactionSummary}
            reviewDraft={reviewDraft}
            onReviewDraftChange={setReviewDraft}
            busy={busy}
            error={error}
            onConfirmPayment={() => void onConfirm()}
            onSubmitReview={() => void onReview()}
            onMockStoryDetect={() => void onMockStoryDetect()}
            showMockStoryButton={MOCK_STORY_DETECT_ENABLED}
            venueInstagramHandle={venueInstagramHandle}
            ticketId={ticketId}
            paymentReturnUrl={paymentReturnUrl}
            onPaymentComplete={() => void load()}
            onPaymentError={setError}
          />
        )}
      </div>
    </div>
  );
}
