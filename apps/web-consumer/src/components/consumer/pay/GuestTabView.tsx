"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, Wallet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { clockTime } from "@mesita/place-profile/lib/money";
import { payChecklist } from "@mesita/place-profile/lib/pay-checklist";
import { type PayStepKey, payStepLabel, SIGN } from "@mesita/place-profile/lib/pay-steps";
import { CashChip, PlainChip } from "@/components/consumer/wallet/WalletLists";
import { Button } from "@/components/ui/button";
import { LocalDialog, LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiCancelTab, apiGetTab, type GuestTab, runBankCheck, TAB_REFUSAL, type TabCardStep, TICKET } from "@/lib/api/tab";
import { money } from "@/lib/api/wallet";
import { endAction } from "@/lib/pay-open";
import { payStrip } from "@/lib/pay-strip";
import { cn } from "@/lib/utils";
import { LiveClock } from "./LiveClock";
import { PaySteps } from "./PaySteps";
import { forgetGuestTab, NETWORK_FAILURE, QUIET_BUTTON_CLASS, readGuestQr, rememberGuestTab } from "./pay-common";

// A GUEST'S OWN PAYMENT (MESITA-3709), at /pay/tab/<id>: the checklist the
// waiter sees too (Amount · Tip · each way it was paid · Waiter signed),
// the QR the waiter scans to Sign, and a live clock (a screenshot is
// visibly stale). Two greens: paid in the app with no cash is green Paid at
// once, and the waiter's Sign adds its tick; with cash it stays amber
// until the waiter signs, then green Paid · Signed. Cancel only while
// nothing moved. From 2 h 30 a line asks the guest to get the waiter's scan;
// past the three-hour window the cash is not signed and earns nothing.
//
// THE TOP (MESITA-3759) comes from payStrip (lib/pay-strip.ts): the seven-step
// strip at "7 · Waiter signs" while it waits, all solid and "Signed" once
// the waiter signed; a payment that ended any other way has no strip and its
// status is the heading. "Sign" is the label; the wire keeps `verified`.
//
// ONE OPEN PAYMENT, WALKED BACK (MESITA-3772): the strip's done segments
// open steps 2 to 6 again as read-only views of what was paid (Ticket,
// Bill, Tip, Methods, Pay), and the header's back arrow steps 7 → 6 → … →
// 2, then leaves. Step 7 ends the payment one of two ways besides the waiter's
// signature: Cancel while nothing moved (the credit comes back), Close once
// money moved and nobody signed (it ends now, no cashback). Cashback turns on
// only with the waiter's signature, card and cash alike.
//
// THE TICKET (MESITA-3776): the band's second line reads "Ticket 1234 ·
// $200.00MX + $30.00MX tip", or the amounts alone when the guest gave none.

/** The steps this page can show, in order (step 1, Pick, is the Pay tab). */
const VIEW_STEPS = ["ticket", "bill", "tip", "methods", "pay", "sign"] as const;
type ViewStep = (typeof VIEW_STEPS)[number];

const FAST_MS = 1500;
const SLOW_MS = 5000;
const NUDGE_BEFORE_END_MS = 30 * 60_000;

export function GuestTabView({
  tab: first,
  getSupabase,
  onPayAgain,
  onDone,
  onEnded,
  registerBack,
}: {
  tab: GuestTab;
  getSupabase: () => Parameters<typeof apiGetTab>[0];
  /** Back to the form at this place (a card failed with nothing paid). */
  onPayAgain: (placeId: string) => void;
  onDone: () => void;
  /** The guest cancelled or closed it: back to the Pay tab. */
  onEnded: () => void;
  /** The header's back arrow asks this first: true when it handled it. */
  registerBack?: (back: (() => boolean) | null) => void;
}) {
  const [tab, setTab] = useState(first);
  const [qr, setQr] = useState<string | null>(() => readGuestQr(first.tab_id));
  const [cardAction, setCardAction] = useState<TabCardStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [details, setDetails] = useState(false);
  const [viewStep, setViewStep] = useState<ViewStep>("sign");
  const [now, setNow] = useState(() => Date.now());
  // When the payment last changed (0 = not read yet): sets the poll's pace.
  const sinceChange = useRef(0);

  const top = payStrip(tab, now);
  const { closed, green } = top;
  const verified = top.signed;
  const done = verified || closed;
  // Only a payment with a strip can be walked back; any other shows step 7.
  const shownStep: ViewStep = top.strip ? viewStep : "sign";

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

  // The header's back arrow: one step back, and off the page from Bill.
  const hasStrip = !!top.strip;
  useEffect(() => {
    if (!registerBack) return;
    registerBack(() => {
      if (!hasStrip) return false;
      const i = VIEW_STEPS.indexOf(viewStep);
      if (i <= 0) return false;
      setViewStep(VIEW_STEPS[i - 1]);
      return true;
    });
    return () => registerBack(null);
  }, [registerBack, viewStep, hasStrip]);

  const m = (c: number) => money(c, tab.currency);
  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const card = tab.card_bill_cents + tab.card_tip_cents;
  const tip = tab.cash_tip_cents + tab.card_tip_cents;
  const total = tab.credit_cents + cash + card;
  const cardPending = tab.parts.some((p) => p.part === "card" && (p.status === "open" || p.status === "opening"));
  const anyPaid = tab.parts.some((p) => p.paid_at);
  // Cancel while nothing moved, Close once money moved unsigned (lib/pay-open.ts).
  const ending = endAction(tab, now);
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
  const nudge = !done && cash > 0 && Date.parse(tab.expires_at) - now <= NUDGE_BEFORE_END_MS;

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      // Close when money moved (no cashback), Cancel when nothing has; the
      // server refuses a stale Cancel after money moved (paid_part).
      await apiCancelTab(getSupabase(), tab.tab_id, ending === "close" ? "close" : "cancel");
      forgetGuestTab(tab.tab_id);
      onEnded();
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
    : closed || !top.strip
    ? "bg-card text-foreground border-border border"
    : "bg-amber-50 text-foreground border border-amber-300";
  const showQr = top.strip === "waiting" && !!qr;
  // ONE STATUS SLOT (MESITA-3739): the most important message only, so the
  // screen never grows past the phone.
  const message: { text: string; tone: "error" | "plain" | "muted" } | null = error
    ? { text: error, tone: "error" }
    : closed && cash > 0 && !verified
    ? { text: SIGN.waiterDidntSign(m(cash)), tone: "plain" }
    : nudge
    ? { text: "Ask the waiter to scan before you leave", tone: "plain" }
    : misses >= 2
    ? { text: "Reconnecting…", tone: "muted" }
    : null;
  // The cashback line (MESITA-3772): only the waiter's signature turns it
  // on, card and cash alike. Granted shows as added; waiting, what signing
  // would earn now; ended unsigned with a card part, that it earned nothing
  // (an unsigned cash part says so in the message line). No line on money
  // that went back or is being checked.
  const onSign = tab.cashback_on_sign_cents ?? tab.cashback_cents;
  const cashback: { text: string; earned: boolean } | null =
    top.state === "refunded" || top.state === "review"
      ? null
      : tab.cashback_cents > 0 && (verified || closed)
      ? { text: `${m(tab.cashback_cents)} in credits added`, earned: true }
      : top.state === "waiting" && onSign > 0
      ? { text: SIGN.creditsOnceSigned(m(onSign)), earned: true }
      : closed && !verified && card > 0 && cash === 0 && (anyPaid || tab.status === "paid")
      ? { text: SIGN.notSignedNoCashback, earned: false }
      : null;
  const placeName = tab.place.name ?? "A Mesita place";
  const strip = (
    <PaySteps
      step={shownStep}
      signed={top.strip === "signed"}
      className="mb-3"
      onStep={(k: PayStepKey) => {
        if (k !== "pick") setViewStep(k);
      }}
      left={<span className="min-w-0 flex-1 truncate text-base font-semibold">{placeName}</span>}
    />
  );

  // STEPS 2 TO 6, READ-ONLY (MESITA-3772): what was paid, from the payment
  // itself; nothing here changes it.
  if (top.strip && shownStep !== "sign") {
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-guest-tab-step={shownStep}>
        {strip}
        <PaidStep step={shownStep} tab={tab} steps={steps} m={m} />
        <div className="mt-auto shrink-0 pt-4">
          <Button size="lg" className="min-h-12 w-full text-base font-semibold" onClick={() => setViewStep("sign")}>
            {top.strip === "waiting" && qr ? "Back to the QR" : "Back to the payment"}
          </Button>
        </div>
      </div>
    );
  }

  const mark = (state: string) => (state === "done" ? "✓" : state === "failed" ? "×" : "○");

  // THE PAID SCREEN FITS (MESITA-3739): the strip (when the payment waits
  // for the waiter or was signed), a status band, then either the QR
  // (sized to the height left, 140–240px, through a size container) with one
  // progress line and the full checklist behind Details, or — once there is
  // no QR to show — the full checklist itself. The action is pinned last.
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-guest-tab={verified ? "verified" : green ? "paid" : closed ? "closed" : "waiting"}>
      {top.strip ? strip : null}
      <div className={cn("shrink-0 rounded-3xl px-4 py-3", surface)}>
        {top.strip ? null : (
          <p className={cn("truncate text-sm font-semibold", green ? "text-white/90" : "text-muted-foreground")}>{placeName}</p>
        )}
        <div className="flex items-center justify-between gap-3">
          {top.heading ? (
            // No strip: the status is the page's heading.
            <h2 className="font-display flex min-w-0 items-center gap-1.5 truncate text-xl font-semibold">
              {green ? <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden /> : null}
              <span className="truncate">{top.heading}</span>
            </h2>
          ) : (
            <p className="font-display flex min-w-0 items-center gap-1.5 truncate text-xl font-semibold" role="status">
              {green ? <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden /> : null}
              <span className="truncate">{top.band}</span>
            </p>
          )}
          <p className="font-display shrink-0 text-2xl font-semibold tabular-nums">{m(total)}</p>
        </div>
        <p className={cn("h-5 truncate text-sm tabular-nums", green ? "text-white/80" : "text-muted-foreground")}>
          {[tab.ticket ? TICKET.label(tab.ticket) : null, tip > 0 ? `${m(total - tip)} + ${m(tip)} tip` : null].filter(Boolean).join(" · ") || " "}
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
        {cashback ? (
          <span className={cn("truncate font-semibold", cashback.earned ? "text-green-700" : "text-muted-foreground")}>{cashback.text}</span>
        ) : null}
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
        ) : ending ? (
          <button type="button" className={cn(QUIET_BUTTON_CLASS, "text-muted-foreground")} onClick={() => setConfirmCancel(true)}>
            {ending === "close" ? "Close" : "Cancel"}
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

      <LocalDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        ariaLabel={ending === "close" ? "Close this payment" : "Cancel this payment"}
      >
        <div className="p-5">
          {ending === "close" ? (
            <>
              <p className="text-base font-semibold">Close this payment?</p>
              <p className="text-muted-foreground mt-1 text-sm">You won&apos;t get cashback for it.</p>
            </>
          ) : (
            <p className="text-base font-semibold">
              Cancel this payment?{tab.credit_cents > 0 ? ` Your ${m(tab.credit_cents)} credit comes back.` : ""}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button className="min-h-12 flex-1 text-base font-semibold" disabled={busy} onClick={() => void cancel()}>
              {ending === "close" ? (busy ? "Closing…" : "Close payment") : busy ? "Cancelling…" : "Cancel payment"}
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

/** One step of the payment, read-only (MESITA-3772): the strip's label is
 *  the heading, then one card of rows, as the steps the guest paid through. */
function PaidStep({
  step,
  tab,
  steps,
  m,
}: {
  step: Exclude<ViewStep, "sign">;
  tab: GuestTab;
  steps: Step[];
  m: (c: number) => string;
}) {
  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const card = tab.card_bill_cents + tab.card_tip_cents;
  const tip = tab.cash_tip_cents + tab.card_tip_cents;
  const bill = tab.bill_cents ?? tab.credit_cents + tab.cash_bill_cents + tab.card_bill_cents;
  const total = tab.credit_cents + cash + card;
  const label = payStepLabel(step, "guest");

  if (step === "ticket") {
    return (
      <div className="mt-6 flex h-14 w-full shrink-0 items-center justify-center" role="group" aria-label={`${label}: ${tab.ticket ?? TICKET.none}`}>
        {tab.ticket ? (
          <p className="max-w-full truncate text-[2.5rem] leading-none font-semibold whitespace-nowrap tabular-nums">{tab.ticket}</p>
        ) : (
          <p className="text-muted-foreground text-base">{TICKET.none}</p>
        )}
      </div>
    );
  }

  if (step === "bill") {
    return (
      <div className="mt-6 flex h-14 w-full shrink-0 items-center justify-center" role="group" aria-label={`${label}: ${m(bill)}`}>
        <p className="text-[2.5rem] leading-none font-semibold whitespace-nowrap tabular-nums">{m(bill)}</p>
      </div>
    );
  }

  if (step === "tip") {
    return (
      <dl className="border-border flex flex-col rounded-2xl border px-4 py-3 text-base tabular-nums" aria-label={label}>
        <PaidLine label="Tip" value={tip > 0 ? m(tip) : "No tip"} />
        {tab.card_tip_cents > 0 ? <PaidLine label="By card" value={m(tab.card_tip_cents)} muted /> : null}
        {tab.cash_tip_cents > 0 ? <PaidLine label="In cash" value={m(tab.cash_tip_cents)} muted /> : null}
      </dl>
    );
  }

  if (step === "methods") {
    const rows: Array<{ key: string; chip: React.ReactNode; title: string; cents: number }> = [];
    if (tab.credit_cents > 0) rows.push({ key: "credit", chip: <PlainChip><Wallet /></PlainChip>, title: "Credit", cents: tab.credit_cents });
    if (card > 0) rows.push({ key: "card", chip: <PlainChip><CreditCard /></PlainChip>, title: "Card", cents: card });
    if (cash > 0) rows.push({ key: "cash", chip: <CashChip />, title: "Cash", cents: cash });
    return (
      <ul className="border-border overflow-hidden rounded-2xl border" aria-label={label}>
        {rows.map((r, i) => (
          <li key={r.key} className={cn("flex min-h-14 items-center justify-between gap-3 px-4 py-2", i > 0 && "border-border border-t")}>
            <span className="flex min-w-0 items-center gap-3.5">
              {r.chip}
              <span className="truncate text-base font-semibold">{r.title}</span>
            </span>
            <span className="shrink-0 text-base tabular-nums">{m(r.cents)}</span>
          </li>
        ))}
      </ul>
    );
  }

  // Pay: the sums, then each way it was paid and where it stands.
  const cardFailed = tab.parts.some((p) => p.part === "card" && !p.paid_at && (p.status === "failed" || p.status === "expired"));
  const ways = steps.filter((s) => s.key === "credit" || s.key === "card" || s.key === "cash");
  const word = (s: Step) =>
    s.key === "card" && cardFailed ? "Failed" : s.state === "done" ? "Paid" : s.note ?? (s.state === "failed" ? "Failed" : "Waiting");
  return (
    <dl className="border-border flex flex-col rounded-2xl border px-4 py-3 text-base tabular-nums" aria-label={label}>
      <PaidLine label="Bill" value={m(bill)} />
      <PaidLine label="Tip" value={tip > 0 ? m(tip) : "No tip"} />
      <div className="border-border mt-1 flex h-8 items-center justify-between gap-3 border-t pt-1 text-lg font-semibold">
        <dt>Total</dt>
        <dd>{m(total)}</dd>
      </div>
      {ways.map((s) => (
        <div key={s.key} className="flex min-h-7 items-center justify-between gap-3 text-sm">
          <dt className="text-muted-foreground min-w-0 truncate">
            {s.label} · {word(s)}
          </dt>
          <dd className="shrink-0">{s.cents !== null ? m(s.cents) : ""}</dd>
        </div>
      ))}
    </dl>
  );
}

function PaidLine({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("flex h-7 items-center justify-between gap-3", muted && "text-sm")}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn(muted && "text-muted-foreground")}>{value}</dd>
    </div>
  );
}
