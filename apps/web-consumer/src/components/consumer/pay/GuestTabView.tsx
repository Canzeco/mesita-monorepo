"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { clockTime } from "@mesita/place-profile/lib/money";
import { payChecklist } from "@mesita/place-profile/lib/pay-checklist";
import { Button } from "@/components/ui/button";
import { LocalDialog, LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
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
  const [details, setDetails] = useState(false);
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
  const showQr = !verified && !closed && !!qr;
  // ONE STATUS SLOT (MESITA-3739): the most important message only, so the
  // screen never grows past the phone.
  const message: { text: string; tone: "error" | "plain" | "muted" } | null = error
    ? { text: error, tone: "error" }
    : closed && cash > 0 && !verified
    ? { text: `The waiter didn't verify · no cashback on the ${m(cash)} cash`, tone: "plain" }
    : nudge
    ? { text: "Ask the waiter to scan before you leave", tone: "plain" }
    : misses >= 2
    ? { text: "Reconnecting…", tone: "muted" }
    : null;
  const cashback =
    tab.cashback_cents > 0
      ? green
        ? `${m(tab.cashback_cents)} in credits added`
        : `${m(tab.cashback_cents)} in credits${cash > 0 ? " once verified" : ""}`
      : null;
  const mark = (state: string) => (state === "done" ? "✓" : state === "failed" ? "×" : "○");

  // THE PAID SCREEN FITS (MESITA-3739): a status band, then either the QR
  // (sized to the height left, 140–240px, through a size container) with one
  // progress line and the full checklist behind Details, or — once there is
  // no QR to show — the full checklist itself. The action is pinned last.
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-guest-tab={verified ? "verified" : green ? "paid" : closed ? "closed" : "waiting"}>
      <div className={cn("shrink-0 rounded-3xl px-4 py-3", surface)}>
        <p className={cn("truncate text-sm font-semibold", green ? "text-white/90" : "text-muted-foreground")}>{tab.place.name ?? "A Mesita place"}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="font-display flex min-w-0 items-center gap-1.5 truncate text-xl font-semibold" role="status">
            {green ? <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden /> : null}
            <span className="truncate">{verified ? "Paid · Verified" : green ? "Paid" : closed ? "Closed" : "Show this to the waiter"}</span>
          </p>
          <p className="font-display shrink-0 text-2xl font-semibold tabular-nums">{m(total)}</p>
        </div>
        <p className={cn("h-5 truncate text-sm tabular-nums", green ? "text-white/80" : "text-muted-foreground")}>
          {tip > 0 ? `${m(total - tip)} + ${m(tip)} tip` : " "}
        </p>
      </div>

      {showQr ? (
        <>
          <div className="mt-3 flex min-h-0 flex-1 items-center justify-center [container-type:size]">
            <div
              className="size-40 rounded-2xl bg-white p-2 ring-1 ring-black/10"
              style={{ width: "max(140px, min(100cqh, 100cqw, 240px))", height: "max(140px, min(100cqh, 100cqw, 240px))" }}
            >
              <QRCodeSVG value={qr} size={240} marginSize={0} style={{ width: "100%", height: "100%" }} title="Your payment's QR for the waiter" />
            </div>
          </div>
          <p className="mt-2 h-6 shrink-0 truncate text-center text-sm" aria-label="Payment">
            {steps.map((s) => `${s.label} ${mark(s.state)}`).join(" · ")}
          </p>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mx-auto flex h-11 shrink-0 items-center text-sm font-semibold underline"
            onClick={() => setDetails(true)}
          >
            Details
          </button>
        </>
      ) : (
        <ol className="border-border mt-3 flex min-h-0 flex-1 flex-col border-t pt-1" aria-label="Payment">
          {steps.map((s) => (
            <ChecklistRow key={s.key} s={s} m={m} at={s.key === "verified" && tab.verified_at ? clockTime(tab.verified_at) : null} />
          ))}
        </ol>
      )}

      <div className="flex h-6 shrink-0 items-center justify-center gap-2 text-sm">
        {!closed ? <LiveClock className="mt-0 text-base" /> : null}
        {!closed && cashback ? <span aria-hidden>·</span> : null}
        {cashback ? <span className="truncate font-semibold text-green-700">{cashback}</span> : null}
      </div>
      <p
        className={cn(
          "h-6 shrink-0 truncate text-center text-sm",
          message?.tone === "error" ? "text-destructive" : message?.tone === "muted" ? "text-muted-foreground" : "font-semibold",
        )}
        role={message?.tone === "error" ? "alert" : "status"}
        data-guest-not-verified={closed && cash > 0 && !verified ? "" : undefined}
      >
        {message?.text ?? ""}
      </p>

      <div className="shrink-0 pt-2">
        {cardAction ? (
          <Button
            size="lg"
            className="min-h-12 w-full text-base font-semibold"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void runBankCheck(cardAction).finally(() => setBusy(false));
            }}
          >
            Finish the bank check
          </Button>
        ) : done || green ? (
          <button type="button" className={QUIET_BUTTON_CLASS} onClick={onDone}>
            Done
          </button>
        ) : canCancel ? (
          <button type="button" className={cn(QUIET_BUTTON_CLASS, "text-muted-foreground")} onClick={() => setConfirmCancel(true)}>
            Cancel
          </button>
        ) : null}
      </div>

      <LocalSheet open={details} onClose={() => setDetails(false)} ariaLabel="Payment details">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <p className="pt-2 pb-2 text-lg font-semibold">Payment</p>
          <ol className="scrollbar-hide flex min-h-0 flex-col overflow-y-auto" aria-label="Payment">
            {steps.map((s) => (
              <ChecklistRow key={s.key} s={s} m={m} at={s.key === "verified" && tab.verified_at ? clockTime(tab.verified_at) : null} />
            ))}
          </ol>
        </div>
      </LocalSheet>

      <LocalDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} ariaLabel="Cancel this payment">
        <div className="p-5">
          <p className="text-base font-semibold">
            Cancel this payment?{tab.credit_cents > 0 ? ` Your ${m(tab.credit_cents)} credit comes back.` : ""}
          </p>
          <div className="mt-4 flex gap-2">
            <Button className="min-h-12 flex-1 text-base font-semibold" disabled={busy} onClick={() => void cancel()}>
              {busy ? "Cancelling…" : "Cancel payment"}
            </Button>
            <button type="button" className={cn(QUIET_BUTTON_CLASS, "flex-1")} onClick={() => setConfirmCancel(false)}>
              Keep it
            </button>
          </div>
        </div>
      </LocalDialog>
    </div>
  );
}

type Step = ReturnType<typeof payChecklist>[number];

/** One checklist line: a 36px row, its note on the same line after a dot. */
function ChecklistRow({ s, m, at }: { s: Step; m: (c: number) => string; at: string | null }) {
  return (
    <li className="flex h-9 items-center gap-3 text-sm" data-state={s.state}>
      <span
        aria-hidden
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 type-meta font-bold",
          s.state === "done"
            ? "border-green-700 bg-green-700 text-white"
            : s.state === "failed"
            ? "border-red-700 bg-red-700 text-white"
            : "border-amber-600 text-amber-700",
        )}
      >
        {s.state === "done" ? "✓" : s.state === "failed" ? "×" : ""}
      </span>
      <span className="min-w-0 flex-1 truncate">
        {s.label}
        {at ? ` · ${at}` : ""}
        {s.note ? <span className="text-muted-foreground"> · {s.note}</span> : null}
      </span>
      {s.cents !== null ? <span className="shrink-0 tabular-nums">{m(s.cents)}</span> : null}
    </li>
  );
}
