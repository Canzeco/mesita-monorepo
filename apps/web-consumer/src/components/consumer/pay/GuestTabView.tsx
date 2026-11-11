"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TEST_BAND_TEXT, TestBand } from "@mesita/place-profile";
import { clockTime } from "@mesita/place-profile/lib/money";
import { payChecklist } from "@mesita/place-profile/lib/pay-checklist";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiCancelTab, apiGetTab, type GuestTab, runBankCheck, TAB_REFUSAL, type TabCardStep } from "@/lib/api/tab";
import { money } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { LiveClock } from "./LiveClock";
import { forgetGuestTab, NETWORK_FAILURE, QUIET_BUTTON_CLASS, readGuestQr, rememberGuestTab } from "./pay-common";

// A GUEST'S OWN PAYMENT (MESITA-3709), at /pay/tab/<id>: the checklist the
// waiter sees too (Amount · Tip · each way it was paid · Waiter verified),
// the QR the waiter scans to Verify, and a live clock (a screenshot is
// visibly stale). Two greens: paid in the app with no cash is green Paid at
// once, and the waiter's Verify adds its tick; with cash it stays amber
// until the waiter verifies, then green Paid · Verified. Cancel only while
// nothing moved. From 2 h 30 a line asks the guest to get the waiter's scan;
// past the three-hour window the cash is not verified and earns nothing.

const FAST_MS = 1500;
const SLOW_MS = 5000;
const NUDGE_BEFORE_END_MS = 30 * 60_000;

export function GuestTabView({
  tab: first,
  getSupabase,
  onPayAgain,
  onDone,
}: {
  tab: GuestTab;
  getSupabase: () => Parameters<typeof apiGetTab>[0];
  /** Back to the form at this place (a card failed, or the guest cancelled). */
  onPayAgain: (placeId: string) => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState(first);
  const [qr, setQr] = useState<string | null>(() => readGuestQr(first.tab_id));
  const [cardAction, setCardAction] = useState<TabCardStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // When the payment last changed (0 = not read yet): sets the poll's pace.
  const sinceChange = useRef(0);

  const closed = tab.status === "expired" || tab.status === "cancelled" || Date.parse(tab.expires_at) <= now;
  const verified = !!tab.verified_at;
  const done = verified || closed;

  // A lost QR (a new browser) is minted again, only for this guest's own tab.
  useEffect(() => {
    if (qr || done) return;
    let cancelled = false;
    void apiGetTab(getSupabase(), tab.tab_id, { remint: true })
      .then((r) => {
        if (cancelled || !r.qr_url) return;
        rememberGuestTab(tab.tab_id, r.qr_url);
        setQr(r.qr_url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr, done, tab.tab_id]);

  // The poll: fast while things move, slower after a quiet minute, paused
  // while hidden, stopped once verified or closed.
  useEffect(() => {
    if (done) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      timer = null;
      if (document.visibilityState === "visible") {
        try {
          const r = await apiGetTab(getSupabase(), tab.tab_id);
          if (!alive) return;
          setMisses(0);
          setCardAction(r.card_action ?? null);
          setTab((old) => {
            if (old.updated_at !== r.tab.updated_at || old.status !== r.tab.status) sinceChange.current = Date.now();
            return r.tab;
          });
          if (r.card_error) setError(TAB_REFUSAL[r.card_error.code] ?? r.card_error.error);
        } catch {
          if (alive) setMisses((n) => n + 1);
        }
      }
      setNow(Date.now());
      if (sinceChange.current === 0) sinceChange.current = Date.now();
      if (alive) timer = setTimeout(() => void tick(), Date.now() - sinceChange.current < 60_000 ? FAST_MS : SLOW_MS);
    };
    timer = setTimeout(() => void tick(), FAST_MS);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, tab.tab_id]);

  useEffect(() => {
    if (done) forgetGuestTab(tab.tab_id);
  }, [done, tab.tab_id]);

  const m = (c: number) => money(c, tab.currency);
  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const card = tab.card_bill_cents + tab.card_tip_cents;
  const tip = tab.cash_tip_cents + tab.card_tip_cents;
  const total = tab.credit_cents + cash + card;
  const cardPending = tab.parts.some((p) => p.part === "card" && (p.status === "open" || p.status === "opening"));
  const anyPaid = tab.parts.some((p) => p.paid_at);
  const canCancel = !verified && !closed && tab.status === "paying" && !anyPaid && !cardPending;
  const steps = payChecklist({
    billCents: tab.bill_cents ?? 0,
    creditCents: tab.credit_cents,
    cardBillCents: tab.card_bill_cents,
    cardTipCents: tab.card_tip_cents,
    cashBillCents: tab.cash_bill_cents,
    cashTipCents: tab.cash_tip_cents,
    cardPending,
    paid: tab.status === "paid",
    verifiedAt: tab.verified_at ?? null,
    closed,
    side: "guest",
  });
  const green = verified || (tab.status === "paid" && cash === 0);
  const nudge = !done && cash > 0 && Date.parse(tab.expires_at) - now <= NUDGE_BEFORE_END_MS;

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await apiCancelTab(getSupabase(), tab.tab_id, "cancel");
      forgetGuestTab(tab.tab_id);
      onPayAgain(tab.place.id);
    } catch (e) {
      const code = e instanceof EFError ? e.code : null;
      setError((code && TAB_REFUSAL[code]) || NETWORK_FAILURE);
      setBusy(false);
      setConfirmCancel(false);
    }
  }

  // A card that failed with nothing paid cancelled the payment: pay again.
  if (tab.status === "cancelled" && first.status !== "cancelled" && !anyPaid) {
    return (
      <div className="flex flex-col gap-4" data-guest-tab="card-failed">
        <p className="text-base font-semibold">{error ?? "Your card didn't go through."}</p>
        <Button size="lg" className="min-h-12 w-full text-base font-semibold" onClick={() => onPayAgain(tab.place.id)}>
          Try another way to pay
        </Button>
      </div>
    );
  }

  const surface = green
    ? "bg-green-700 text-white"
    : closed
    ? "bg-card text-foreground border-border border"
    : "bg-amber-50 text-foreground border border-amber-300";

  return (
    <div className="flex flex-col" data-guest-tab={verified ? "verified" : green ? "paid" : closed ? "closed" : "waiting"}>
      {tab.test_mode && !green ? <TestBand className="mb-3" /> : null}
      <div className={cn("rounded-3xl px-4 py-5", surface)}>
        {tab.test_mode && green ? <p className="mb-3 w-fit rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{TEST_BAND_TEXT}</p> : null}
        <p className={cn("text-base font-semibold", green ? "text-white" : "")}>{tab.place.name ?? "A Mesita place"}</p>
        <div className="mt-1 flex items-center gap-2">
          {green ? <CheckCircle2 className="h-7 w-7 shrink-0" aria-hidden /> : null}
          <p className="font-display text-2xl font-semibold" role="status">
            {verified ? "Paid · Verified" : green ? "Paid" : closed ? "Closed" : "Show this to the waiter"}
          </p>
        </div>
        <p className={cn("font-display mt-1 text-4xl font-semibold tabular-nums")}>{m(total)}</p>
        {tip > 0 ? <p className={cn("text-sm tabular-nums", green ? "text-white/80" : "text-muted-foreground")}>{m(total - tip)} + {m(tip)} tip</p> : null}

        <ol className={cn("mt-4 flex flex-col border-t pt-2", green ? "border-white/25" : "border-border")} aria-label="Payment">
          {steps.map((s) => (
            <li key={s.key} className="flex min-h-11 items-center gap-3" data-state={s.state}>
              <span
                aria-hidden
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs font-bold",
                  s.state === "done"
                    ? green
                      ? "border-white bg-white text-green-700"
                      : "border-green-700 bg-green-700 text-white"
                    : s.state === "failed"
                    ? "border-red-700 bg-red-700 text-white"
                    : "border-amber-600 text-amber-700",
                )}
              >
                {s.state === "done" ? "✓" : s.state === "failed" ? "×" : ""}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base">
                  {s.label}
                  {s.key === "verified" && tab.verified_at ? ` · ${clockTime(tab.verified_at)}` : ""}
                </span>
                {s.note ? <span className={cn("text-sm", green ? "text-white/80" : "text-muted-foreground")}>{s.note}</span> : null}
              </span>
              {s.cents !== null ? <span className="text-base tabular-nums">{m(s.cents)}</span> : null}
            </li>
          ))}
        </ol>

        {!verified && !closed && qr ? (
          <div className="mt-4 flex flex-col items-center">
            <div className="rounded-2xl bg-white p-3">
              <QRCodeSVG value={qr} size={208} marginSize={0} title="Your payment's QR for the waiter" />
            </div>
          </div>
        ) : null}
        {!closed ? <LiveClock className={cn("text-center", green ? "text-white" : "")} /> : null}
        {tab.cashback_cents > 0 ? (
          <p className={cn("mt-2 text-center text-base font-semibold", green ? "text-white" : "text-green-700")}>
            You get {m(tab.cashback_cents)} back here
          </p>
        ) : null}
      </div>

      {cardAction ? (
        <Button
          size="lg"
          className="mt-4 min-h-12 w-full text-base font-semibold"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void runBankCheck(cardAction).finally(() => setBusy(false));
          }}
        >
          Finish the bank check
        </Button>
      ) : null}
      {nudge ? (
        <p className="mt-3 text-base font-semibold" role="status">
          Ask the waiter to scan before you leave
        </p>
      ) : null}
      {closed && cash > 0 && !verified ? (
        <p className="mt-3 text-base" role="status" data-guest-not-verified>
          The waiter didn&apos;t verify · no cashback on the {m(cash)} cash
        </p>
      ) : null}
      {misses >= 2 ? (
        <p className="text-muted-foreground mt-3 text-sm" role="status">
          Reconnecting…
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {confirmCancel ? (
        <div className="border-foreground bg-card mt-4 rounded-2xl border-2 p-4" role="dialog" aria-label="Cancel this payment">
          <p className="text-base font-semibold">
            Cancel this payment?{tab.credit_cents > 0 ? ` Your ${m(tab.credit_cents)} credit comes back.` : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <Button className="min-h-12 flex-1 text-base font-semibold" disabled={busy} onClick={() => void cancel()}>
              {busy ? "Cancelling…" : "Cancel payment"}
            </Button>
            <button type="button" className={cn(QUIET_BUTTON_CLASS, "flex-1")} onClick={() => setConfirmCancel(false)}>
              Keep it
            </button>
          </div>
        </div>
      ) : canCancel ? (
        <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-4")} onClick={() => setConfirmCancel(true)}>
          Cancel
        </button>
      ) : null}
      {done || green ? (
        <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-4")} onClick={onDone}>
          Done
        </button>
      ) : null}
    </div>
  );
}
