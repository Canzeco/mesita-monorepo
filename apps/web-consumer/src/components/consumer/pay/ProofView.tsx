"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PlaceMarks, TestBand } from "@mesita/place-profile";
import { clockTime } from "@mesita/place-profile/lib/money";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { apiGetPayment, money, type PayProof } from "@/lib/api/wallet";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { LiveClock } from "./LiveClock";
import { isGone, isOpen, NETWORK_FAILURE, QUIET_BUTTON_CLASS } from "./pay-common";

// THE PROOF (MESITA-3459): the big figure is amount + tip ("MX$300 + MX$30
// tip" under it), then the place, "Paid · HH:mm", a live clock
// (aria-hidden), the ticket when the server sends it, and the QR last.
// While unseen the screen reads the payment every 5 s while visible, stops
// on Seen, while hidden or after 15 minutes, and reads once on becoming
// visible again; "Paid" swaps to "Seen · HH:mm" in a polite live region. Two
// failed reads grey the line with "Reconnecting"; a 403/404 stops polling
// with "This payment isn't on your account". A paid return from Stripe
// reads "Confirming…" for 30 s, then "Still confirming" with Refresh;
// "Payment didn't go through" only when the server says expired or failed.

/** How long a paid return reads "Confirming…" before "Still confirming". */
const CONFIRM_PATIENCE_MS = 30_000;
/** The proof re-reads the payment this often while visible (MESITA-3459). */
const POLL_MS = 5_000;
/** ...and stops after this long; becoming visible again reads once. */
const POLL_STOP_AFTER_MS = 15 * 60_000;

export function ProofView({
  proof,
  onChange,
  onDone,
}: {
  proof: PayProof;
  onChange: (p: PayProof) => void;
  onDone: () => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const refunded = proof.status === "refunded";
  const partly = proof.status === "partly_refunded";
  // The card part's Checkout is still open (MESITA-3305): no proof yet.
  const open = proof.status === "open" || proof.status === "opening";
  // Closed with no money: Stripe expired it, or refused it.
  const closed = proof.status === "expired" || proof.status === "failed";
  const review = proof.status === "needs_review";
  const seen = proof.proof_seen_at;
  // A 403/404 on a read: not this guest's payment; polling stops.
  const [gone, setGone] = useState(false);
  // Two failed reads in a row grey the Paid line with "Reconnecting".
  const [failures, setFailures] = useState(0);
  const reconnecting = failures >= 2;
  const watch = !gone && ((!seen && !refunded && !closed && !review) || open);
  // A paid return reads "Confirming…" for 30 s, then "Still confirming".
  const [slow, setSlow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const m = (cents: number) => money(cents, proof.currency);
  const tip = proof.tip_cents ?? 0;

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setSlow(true), CONFIRM_PATIENCE_MS);
    return () => clearTimeout(t);
  }, [open, proof.payment_id]);

  function refresh() {
    setRefreshing(true);
    void apiGetPayment(getSupabase(), proof.payment_id)
      .then(onChange)
      .catch((e) => (isGone(e) ? setGone(true) : toast(NETWORK_FAILURE, { tone: "error" })))
      .finally(() => setRefreshing(false));
  }

  // Leaving an unconfirmed payment reads it once more: a payment that went
  // through in the meantime shows its proof, never the form.
  function leave() {
    if (!open) {
      onDone();
      return;
    }
    void apiGetPayment(getSupabase(), proof.payment_id)
      .then((p) => (isOpen(p) || p.status === "expired" || p.status === "failed" ? onDone() : onChange(p)))
      .catch(() => onDone());
  }

  // Re-read every 5 s while visible, so the screen turns to Seen when the
  // waiter taps. Stops on Seen, while hidden, after 15 minutes, or on a
  // 403/404; one read when the page becomes visible again.
  useEffect(() => {
    if (!watch) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const read = () =>
      apiGetPayment(getSupabase(), proof.payment_id)
        .then((p) => {
          if (cancelled) return;
          setFailures(0);
          onChange(p);
        })
        .catch((e) => {
          if (cancelled) return;
          if (isGone(e)) {
            if (timer) clearTimeout(timer);
            setGone(true);
            return;
          }
          // A failed read keeps the QR and tries next tick.
          setFailures((n) => n + 1);
        });
    const tick = () => {
      if (cancelled || Date.now() - started > POLL_STOP_AFTER_MS || document.hidden) return;
      void read().then(() => {
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      });
    };
    timer = setTimeout(tick, POLL_MS);
    const onVisible = () => {
      if (document.hidden) {
        if (timer) clearTimeout(timer);
        timer = undefined;
        return;
      }
      if (timer) clearTimeout(timer);
      timer = undefined;
      // One read on coming back; inside the 15 minutes polling resumes.
      void read().then(() => {
        if (!cancelled && Date.now() - started <= POLL_STOP_AFTER_MS) timer = setTimeout(tick, POLL_MS);
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proof.payment_id, watch]);

  if (gone) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="border-border bg-card flex w-full flex-col items-center rounded-2xl border px-6 py-6">
          <p className="text-sm font-semibold" role="status">This payment isn&apos;t on your account</p>
        </div>
        <Button size="lg" className="mt-6 w-full text-base font-semibold" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  const paid = !open && !closed && !!proof.paid_at;
  const refundLine = refunded
    ? "Refunded"
    : partly
      ? proof.refunded_cents
        ? `Refunded ${m(proof.refunded_cents)}`
        : "Partly refunded"
      : null;

  return (
    <div className="flex flex-col items-center text-center">
      {proof.test_mode ? <TestBand className="mb-3 w-full text-left" /> : null}
      <div className="border-border bg-card flex w-full flex-col items-center rounded-2xl border px-6 py-6">
        {open ? (
          slow ? (
            <>
              <p className="text-sm font-semibold" role="status">Still confirming</p>
              <p className="text-muted-foreground mt-1 text-sm">We&apos;ll show the proof as soon as Stripe answers.</p>
            </>
          ) : (
            <p className="text-sm font-semibold" role="status">Confirming…</p>
          )
        ) : closed ? (
          <p className="text-sm font-semibold" role="status">Payment didn&apos;t go through</p>
        ) : review ? (
          <p className="text-sm font-semibold" role="status">We&apos;re checking this payment.</p>
        ) : !refunded && !seen ? (
          <p className="text-muted-foreground text-sm font-semibold">Show this to the staff</p>
        ) : null}
        <p className="font-display mt-3 text-4xl font-semibold tabular-nums" data-proof-total>
          {m(proof.amount_cents + tip)}
        </p>
        {tip > 0 ? (
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">
            {m(proof.amount_cents)} + {m(tip)} tip
          </p>
        ) : null}
        {proof.card_cents && proof.credit_cents ? (
          <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
            {m(proof.credit_cents)} from credit · {m(proof.card_cents)} by card
          </p>
        ) : null}
        {refundLine ? <p className="text-muted-foreground mt-1 text-sm font-semibold">{refundLine}</p> : null}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-base font-semibold">
          <span className="min-w-0 truncate">{proof.place_name ?? "A Mesita place"}</span>
          {proof.place_marks ? <PlaceMarks tier={proof.place_marks.tier} mesitaPay={proof.place_marks.mesita_pay} ad={false} /> : null}
        </p>
        {paid ? (
          <p
            className={cn("mt-0.5 flex items-center gap-1.5 text-sm", reconnecting ? "text-muted-foreground opacity-60" : "text-foreground")}
            aria-live="polite"
            data-proof-status
          >
            {seen ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : null}
            {seen ? `Seen · ${clockTime(seen)}` : `Paid · ${clockTime(proof.paid_at as string)}`}
            {reconnecting && !seen ? <span> · Reconnecting</span> : null}
          </p>
        ) : null}
        {paid && !refunded ? <LiveClock /> : null}
        {proof.ticket ? <p className="text-muted-foreground mt-1 text-sm">Ticket {proof.ticket}</p> : null}
        {!refunded && proof.proof ? (
          <div className={cn("mt-4 rounded-xl bg-white p-3 transition", seen && "opacity-40")}>
            <QRCodeSVG value={proof.proof.url} size={208} marginSize={0} aria-label="Payment proof" />
          </div>
        ) : null}
      </div>
      {open ? (
        <>
          {proof.url ? (
            <Button size="lg" className="mt-6 w-full text-base font-semibold" onClick={() => window.location.assign(proof.url as string)}>
              Resume card payment
            </Button>
          ) : null}
          {slow ? (
            <button
              type="button"
              className={cn(QUIET_BUTTON_CLASS, proof.url ? "mt-3" : "mt-6")}
              disabled={refreshing}
              onClick={refresh}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          ) : null}
          <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3")} onClick={leave}>
            Done
          </button>
        </>
      ) : (
        <Button size="lg" className="mt-6 w-full text-base font-semibold" onClick={onDone}>
          Done
        </Button>
      )}
    </div>
  );
}

export function ProofSkeleton() {
  return (
    <div className="border-border bg-card flex flex-col items-center rounded-2xl border px-6 py-6" aria-busy>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-[232px] w-[232px] rounded-xl" />
      <Skeleton className="mt-5 h-9 w-32" />
      <Skeleton className="mt-3 h-4 w-28" />
    </div>
  );
}
