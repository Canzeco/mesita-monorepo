"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, Check, ReceiptText, XCircle } from "lucide-react";
import { readAmount } from "@mesita/place-profile/lib/money";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiListVisits, apiPayGuest, type PayWith, TAB_REFUSAL } from "@/lib/api/tab";
import { pickOpenGuestPayment } from "@/lib/pay-open";
import { discountOf, money, type PayPlace, payPlaceDiscountBps } from "@/lib/api/wallet";
import { closeAction, guardStage, initialStage, payBackStage } from "@/lib/guest-pay-stages";
import {
  clearGuestDraft,
  outcomeUnknownAfter,
  pendingTicket,
  PENDING_NAME_KEY,
  readDraft,
  readLastTip,
  requestIdAfterEdit,
  type Tip,
  TIP_CHIPS,
  type Stage,
  writeDraft,
  writeLastTip,
} from "@/lib/guest-pay-draft";
import { trackEvent } from "@/lib/analytics/track";
import { type PadKey, pressKey, readTip } from "@/lib/pay-keypad";
import { cn } from "@/lib/utils";
import { AmountDisplay, AmountKeypad } from "./AmountKeypad";
import { CashChip, CreditsCardChip, CreditsPill } from "@/components/consumer/wallet/WalletLists";
import { BAD, MoneyRow, NOT_PAID_REASON, PaySection, PayTitle, PlaceHero, StepBody, StepFooter } from "./pay-flow";
import { NETWORK_FAILURE, QUIET_BUTTON_CLASS, rememberGuestTab } from "./pay-common";

// THE GUEST PAYS (MESITA-3861, Pato's "14. Payments Flow Guest-Lead"), at
// /pay/place/<placeId>, one screen a step. Every step wears one frame
// (MESITA-4061, Pato: "X Pay / Profile Name of place / steps with arrows to
// nav across them < > / the actual body free of nav buttons / cancel button
// and next step button"): the header's X · Pay, the place row (tapping the
// name chooses another place), the step nav ‹ "Tip · 2 of 5" ›, one body
// group centred both ways, then Cancel bill and the step's button.
//
//   1 Bill    the amount and a large keypad under ReceiptText (Off: the
//             place large across the top, saying why).
//   2 Tip     the tip chips (10%,
//             15%, Other) with HandCoins and the summary card: Bill, Tip,
//             Total, and the Coins line.
//   3 Method  the Wallet switch "Use my credits" (MESITA-4068: asked here,
//             not on Tip; on by default; credits never pay the tip), what is
//             left, then Pay outside the app (cash or the place's own
//             terminal) for all of it. Credits cover everything and no tip:
//             "Show the waiter" opens the bill.
//   4 Cash    "Give MX$X to the waiter", then "I gave the cash".
//
// MESITA-4708: NO CARD FOR A BILL. The Card way (a saved card held at Show
// the waiter, MESITA-4524) and Apple Pay / Google Pay (MESITA-4386) are gone:
// cards buy vouchers only.
//
// Paying opens the bill (/pay/bill/<id>, GuestTabView: Confirm, Confirming,
// Receipt, Not paid). The header's back arrow steps back.
//
// ONE TICKET AT A TIME (MESITA-3879, Pato: "imagine someone closes the app
// while in one step in between ... you first need to enter the ticket and
// resolve it before anything"): the draft lives in localStorage with one
// pending pointer once an amount is typed. While it's pending, /pay and
// every other place's Pay open it where it was left; the X (or the place
// name) leaves and keeps it, Cancel bill throws it away. A bill already open on the
// server comes first. Drafts still expire 30 minutes after their last change. Every rule and peso is the
// server's; this screen proposes.

/** What blocks a new ticket here (MESITA-3908). */
type Blocked = { kind: "draft"; placeId: string; name: string | null } | { kind: "bill"; tabId: string; name: string | null };

const STILL_WORKING = "Still working. Tap again to try again.";
const CALL_LIMIT_MS = 25_000;
class SlowCall extends Error {}

/** A hung payment call frees the screen after 25 s. Tapping again resends the
 *  same request id, so it never pays twice. */
function withinLimit<T>(call: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SlowCall()), CALL_LIMIT_MS);
  });
  return Promise.race([call, limit]).finally(() => clearTimeout(timer));
}

// The draft helpers live in lib/guest-pay-draft (MESITA-4061); these are
// the names the other pay screens import from here.
export { clearGuestDraft, pendingTicket, pendingTicketPlace, reopenGuestDraft } from "@/lib/guest-pay-draft";

export function GuestPayScreen({
  placeId,
  places,
  placesFailed,
  getSupabase,
  onPaid,
  onChoosePlace,
  onLeavePay,
  onOpenPlace,
  registerBack,
  registerClose,
}: {
  placeId: string;
  places: PayPlace[] | null;
  placesFailed: boolean;
  getSupabase: () => Parameters<typeof apiListVisits>[0];
  /** The bill exists (or the guest's one open bill): open it. */
  onPaid: (tabId: string) => void;
  /** Open: the search to choose another place. */
  onChoosePlace: () => void;
  /** Cancel bill: back to Pay, sheet shut. */
  onLeavePay: () => void;
  /** Another place's ticket is pending: open it there (MESITA-3879). */
  onOpenPlace: (placeId: string) => void;
  /** The header's back arrow asks this first: true when it handled it. */
  registerBack?: (back: (() => boolean) | null) => void;
  /** The header's X (MESITA-3880) runs this. */
  registerClose?: (close: (() => void) | null) => void;
}) {
  const place = places?.find((p) => p.place_id === placeId) ?? null;
  // The tabs' banner names the place (MESITA-3906).
  const placeName = place?.name ?? null;
  useEffect(() => {
    if (!placeName) return;
    try {
      window.localStorage.setItem(PENDING_NAME_KEY, placeName);
    } catch {
      // The banner says "a ticket" without the name.
    }
  }, [placeName]);
  const [draft] = useState(() => readDraft(placeId));
  // A bill already sent from this draft: straight to its QR (MESITA-3997).
  const sentTabId = draft?.sentTabId ?? null;
  useEffect(() => {
    if (sentTabId) onPaid(sentTabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentTabId]);
  // A draft at Pay with credits off starts at Method (MESITA-4117):
  // credits come back on by default, so the guest sees the new split.
  const [stage, setStage] = useState<Stage>(() => initialStage(draft));
  const [typing, setTyping] = useState(draft?.typing ?? true);
  const [amount, setAmount] = useState(draft?.amount ?? "");
  // A draft from before MESITA-3876 may hold the retired 0 chip: no pick.
  const [tip, setTip] = useState<Tip>(draft && (draft.tip === "other" || TIP_CHIPS.includes(draft.tip as 10)) ? draft.tip : readLastTip(placeId));
  const [other, setOther] = useState(draft?.other ?? "");
  // Credits are on by default, every time the bill opens (MESITA-4100,
  // Pato: "PAY WITH CREDITS MUST BE SELECTED AS DEFAULT"): a switch turned
  // off is not carried over from a saved draft.
  const [useCredit, setUseCredit] = useState(true);
  const [method, setMethod] = useState<PayWith | null>(draft?.method ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notPaid, setNotPaid] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  // A pay call timed out or lost the network: the bill may be open on the
  // server. Until that same request id answers, Cancel bill and ‹ are locked
  // and nothing mints a new id (MESITA-4061).
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [cashDue, setCashDue] = useState<number | null>(null);
  // MESITA-4770: the discount rate the server answered (discount_changed).
  const [serverDiscountBps, setServerDiscountBps] = useState<number | null>(null);

  // ONE TICKET AT A TIME (MESITA-3879, MESITA-3908): another place's ticket
  // in progress, or a bill open on the server at another place, blocks this
  // one with "Finish this bill first"; nothing redirects. A bill open here
  // opens.
  const [blocked, setBlocked] = useState<Blocked | null>(() => {
    const other = pendingTicket();
    return other && other.placeId !== placeId ? { kind: "draft", placeId: other.placeId, name: other.name } : null;
  });
  useEffect(() => {
    let cancelled = false;
    void apiListVisits(getSupabase())
      .then((r) => {
        const open = pickOpenGuestPayment(r.visits, Date.now());
        if (cancelled || !open) return;
        if (open.place.id === placeId) onPaid(open.tab_id);
        else setBlocked({ kind: "bill", tabId: open.tab_id, name: open.place.name });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);
  const root = useRef<HTMLDivElement | null>(null);

  const cashOk = place?.outside_ok === true;
  const spendable = Math.max(place?.available_cents ?? 0, 0);
  const off = !!place && !cashOk && spendable === 0;
  const m = (c: number) => money(c, place?.currency ?? "mxn");
  // The X closes and keeps the ticket (MESITA-3908): Pay shows it, the
  // tabs show the banner. Cancelling is its own button.
  const leave = () => {
    if (busy) return;
    onChoosePlace();
  };
  // THE ✕ CLOSES THE FLOW AND THE TICKET IS GONE (Pato, 2026-11-21,
  // MESITA-4598: "the ticket is not saved until resolved … if i close the
  // ticket before finishing, the ticket is gone, not saved"; picked "gone at
  // once"): what was typed here is dropped and Pay shows, no question. A
  // ticket already on the server (an answer still coming) is
  // real: ✕ only leaves it. It kept the draft before (MESITA-3908).
  // MESITA-4600: the rule lives in closeAction (pinned by a test). A cash
  // bill already handed over (cashDue) is open on the server too.
  const closeFlow = () => {
    const act = closeAction({ busy, billOpen: outcomeUnknown || cashDue !== null });
    if (act === "ignore") return;
    if (act === "discard") clearGuestDraft(placeId);
    onLeavePay();
  };

  // The sums. MESITA-4770: a visit Discount comes off the printed bill before
  // credit and cash split what is left; the tip is on the printed bill. The
  // server works out the same and answers discount_changed with its own
  // numbers when they differ (serverDiscountBps then wins).
  const billCents = readAmount(amount) ?? 0;
  const tipCents = tip === null ? 0 : tip === "other" ? readTip(other) ?? 0 : Math.round((billCents * tip) / 100);
  const discountBps = serverDiscountBps ?? payPlaceDiscountBps(place);
  const discountCents = discountOf(billCents, discountBps);
  const toPayCents = billCents - discountCents;
  const discountLabel = place?.visit_line === "returning" ? "Returning discount" : "Welcome discount";
  const creditOn = useCredit && spendable > 0;
  const creditCents = creditOn ? Math.min(spendable, toPayCents) : 0;
  const leftCents = toPayCents - creditCents;
  const dueCents = leftCents + tipCents;
  // Why the Cash row is grey (one line), null when it can pay what's left.
  const cashWhy = place && !cashOk ? "This place doesn't take cash through Mesita." : null;
  const cashOn = !cashWhy;
  // The way the rest goes: outside the app, where the place takes it.
  const way: PayWith | null = cashOn ? "cash" : null;
  const creditsOnly = dueCents === 0;
  // The step shown (MESITA-4117): a stored or live stage that stopped making
  // sense goes back to Method. Pure, so nothing sets state while rendering.
  const shown = guardStage({ stage, method, way, dueCents });

  // Every change is saved, so the X comes back to it.
  useEffect(() => {
    if (sentTabId) return;
    requestId.current = requestIdAfterEdit(requestId.current, outcomeUnknown);
    writeDraft(placeId, { stage: shown, typing, amount, tip, other, useCredit, method });
  }, [sentTabId, placeId, shown, typing, amount, tip, other, useCredit, method, outcomeUnknown]);

  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [shown, typing, notPaid]);

  // Which step the guest reached (MESITA-4124). Bill and Tip share "bill";
  // the keypad is Bill, the chips are Tip.
  useEffect(() => {
    const step = shown === "bill" ? (typing ? "bill" : "tip") : shown;
    trackEvent(getSupabase(), "pay_step_view", { step });
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, typing]);

  // The header's X leaves (MESITA-3880), with the latest state each render.
  useEffect(() => {
    registerClose?.(closeFlow);
  });
  useEffect(() => () => registerClose?.(null), [registerClose]);

  // One step back: the header's back arrow, the hardware back and ‹ all run
  // this (MESITA-4061). True when it handled it; false on the keypad, where
  // the header goes back in history and the draft stays.
  function backOneStep(): boolean {
    if (busy || outcomeUnknown) return true;
    if (notPaid) {
      setNotPaid(null);
      return true;
    }
    if (shown === "pay" || shown === "method") setStage(payBackStage(shown));
    else {
      // ← on the first step reopens the places (MESITA-4598, step 1 of the
      // flow); history-back before.
      leave();
      return true;
    }
    setError(null);
    return true;
  }
  useEffect(() => {
    registerBack?.(backOneStep);
  });
  useEffect(() => () => registerBack?.(null), [registerBack]);

  /** Opens the bill: credits only, or the cash given. */
  async function openBill(w: PayWith | null) {
    if (!place || busy || billCents <= 0) return;
    setBusy(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    const cash = w === "cash" ? leftCents : 0;
    try {
      const r = await withinLimit(apiPayGuest(getSupabase(), {
        place_id: placeId,
        bill_cents: billCents,
        request_id: requestId.current,
        credit_cents: creditCents,
        cash_bill_cents: cash,
        cash_tip_cents: w === "cash" ? tipCents : 0,
      }));
      if (r.status === "due" || !r.tab_id) {
        setCashDue(r.status === "due" ? dueCents : null);
        setBusy(false);
        if (r.status === "due") return;
      }
      if (!r.tab_id) {
        setError("The payment is still going through.");
        return;
      }
      rememberGuestTab(r.tab_id, r.qr_url);
      writeLastTip(placeId, tip);
      // Start again comes back to the bill with everything typed.
      writeDraft(placeId, { stage: "bill", typing: false, amount, tip, other, useCredit, method, sentTabId: r.tab_id ?? undefined });
      setOutcomeUnknown(false);
      onPaid(r.tab_id);
    } catch (e) {
      const code = e instanceof EFError ? e.code : null;
      if (code) requestId.current = null;
      setOutcomeUnknown(outcomeUnknownAfter(code));
      // MESITA-4524: the open one is a ticket (open_attempt_id) or an older bill.
      const openId = code === "too_many_open" && e instanceof EFError ? (e.body?.open_attempt_id ?? e.body?.open_tab_id) : null;
      if (typeof openId === "string" && openId) {
        onPaid(openId);
        return;
      }
      setBusy(false);
      // MESITA-4770: the place's discount differs from the preview; take the
      // server's rate and show the new amounts before the guest taps again.
      if (code === "discount_changed" && e instanceof EFError && typeof e.body?.discount_bps === "number") {
        setServerDiscountBps(e.body.discount_bps);
        setError("The discount here changed. Check the new amount and tap again.");
        return;
      }
      if (code && NOT_PAID_REASON[code]) {
        setNotPaid(NOT_PAID_REASON[code]);
        return;
      }
      if (e instanceof SlowCall) {
        setError(STILL_WORKING);
        return;
      }
      setError((code && TAB_REFUSAL[code]) || (e instanceof EFError && (e.status ?? 500) < 500 && e.message) || NETWORK_FAILURE);
    }
  }

  if (sentTabId) return <GuestPayLoading />;

  if (blocked) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-guest-pay="blocked">
        <StepBody>
          <PaySection className="flex flex-col items-center p-4 text-center">
            <ReceiptText className="h-10 w-10 text-amber-700" aria-hidden />
            <h2 className="mt-2 text-xl font-semibold">Finish this bill first</h2>
            <p className="mt-2 text-base">You have a bill open{blocked.name ? ` at ${blocked.name}` : ""}.</p>
            <p className="text-muted-foreground mt-1 text-sm">Pay it or cancel it before starting another.</p>
          </PaySection>
        </StepBody>
        <Button
          type="button"
          className="min-h-12 w-full shrink-0 text-base font-semibold"
          onClick={() => (blocked.kind === "bill" ? onPaid(blocked.tabId) : onOpenPlace(blocked.placeId))}
        >
          Go to bill
        </Button>
        {blocked.kind === "draft" ? (
          <button
            type="button"
            className={cn("mt-2 flex h-11 shrink-0 items-center justify-center text-sm font-semibold", BAD)}
            onClick={() => {
              clearGuestDraft(blocked.placeId);
              setBlocked(null);
            }}
          >
            Cancel that bill
          </button>
        ) : null}
      </div>
    );
  }

  if (!place) {
    if (placesFailed || (places && !place)) {
      return (
        <div className="flex flex-col gap-4" data-guest-pay="unavailable">
          <p className="text-base font-semibold">This place isn&apos;t taking Mesita payments right now.</p>
          <button type="button" className={QUIET_BUTTON_CLASS} onClick={onChoosePlace}>
            Choose another place
          </button>
        </div>
      );
    }
    return (
      <>
        <PayTitle title="How much was your bill?" back />
        <BillStepBones />
      </>
    );
  }

  // Desktop keys reach the keypad.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.metaKey || e.ctrlKey || e.altKey || shown !== "bill" || !typing) return;
    const key: PadKey | null = /^[0-9]$/.test(e.key) ? (e.key as PadKey) : e.key === "." ? "." : e.key === "Backspace" ? "back" : null;
    if (key) {
      e.preventDefault();
      setAmount((t) => pressKey(t, key));
    } else if (e.key === "Enter" && billCents > 0) {
      e.preventDefault();
      setTyping(false);
    }
  }

  const frame = (body: React.ReactNode, data: string) => (
    <div ref={root} tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none" onKeyDown={onKeyDown} data-guest-pay={data}>
      {body}
    </div>
  );
  // Under the body, over the footer; cleared on every step change.
  const status = error ? (
    <p className="text-destructive shrink-0 pt-2 text-center text-sm" role="alert">
      {error}
    </p>
  ) : null;
  const held = busy;
  // Every screen's title (MESITA-4600): the question, no place. ← steps
  // back through backOneStep (the header's ←, registered above); Cancel bill
  // left the footer, the ✕ throws the ticket away (MESITA-4598).
  const top = (title: string) => <PayTitle title={title} back />;

  // NOT PAID (before the bill opened: refused).
  if (notPaid) {
    return frame(
      <>
        <PayTitle title="Not paid" back />
        <StepBody>
          <PaySection className="flex flex-col items-center p-4 text-center">
            <XCircle className={cn("h-10 w-10", BAD)} aria-hidden />
            <p className="mt-2 text-base">{notPaid}</p>
            <p className="text-muted-foreground mt-1 text-sm">Nothing was charged</p>
          </PaySection>
        </StepBody>
        <StepFooter
          primary={{
            label: "Start again",
            busy,
            disabled: held,
            onClick: () => {
              setNotPaid(null);
              setStage("bill");
              setTyping(false);
            },
          }}
        />
      </>,
      "not-paid",
    );
  }

  if (cashDue !== null) {
    return frame(
      <>
        <PayTitle title="Hand over cash" />
        <StepBody>
          <PaySection className="p-6 text-center">
            <p className="mt-1 text-4xl font-semibold tabular-nums">{m(cashDue)}</p>
            <p className="text-muted-foreground mt-3 text-sm">The place marks this received. Nothing else is charged.</p>
          </PaySection>
        </StepBody>
        <StepFooter strip={3} />
      </>,
      "cash-due",
    );
  }

  // OPEN, OFF: the place doesn't take Mesita payments at all.
  if (off) {
    return frame(
      <>
        <PayTitle title="Can't pay here" />
        <PlaceHero place={place} off onChoose={onChoosePlace} />
        <StepBody>
          <PaySection className="p-4 text-center">
            <p className="text-base font-semibold">This place doesn&apos;t take Mesita payments.</p>
            <p className="text-muted-foreground mt-1 text-sm">Pay the usual way, outside Mesita.</p>
          </PaySection>
        </StepBody>
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={onChoosePlace}>
          Choose another place
        </button>
      </>,
      "off",
    );
  }

  const tipChip = (on: boolean) =>
    cn(
      "flex h-11 flex-1 items-center justify-center rounded-full border text-base font-semibold transition",
      on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
    );

  // 2 BILL, ONE SCREEN FOR THE BILL AND THE TIP (named "Bill" since
  // MESITA-4630) (Pato, 2026-11-21, MESITA-4619: "Bill & Tip
  // MERGE THESE TWO into one.. KEEP IT CLEAN"): the typed bill big on top,
  // the tip chips under it with the tip and the total on one line, the
  // keypad below (it types the bill, or the tip while Other is picked),
  // Next to Method. Two screens before (the keypad, then "Add a tip?").
  if (shown === "bill") {
    const tipOk = tip !== null;
    const tipTyping = tip === "other";
    const toMethod = () => {
      if (billCents <= 0 || !tipOk) return;
      setTyping(false);
      setStage("method");
    };
    return frame(
      <>
        {top("Bill")}
        <div className="flex min-h-0 flex-1 flex-col gap-3 py-4">
          <PaySection className="flex min-h-0 shrink flex-col">
            <div className="flex min-h-0 shrink flex-col px-4 pt-3 pb-2">
              <AmountDisplay text={amount} currency={place.currency} label="Bill" className="shrink-0" />
              <div className="mt-3 flex shrink-0 gap-2" role="group" aria-label="Tip">
                {TIP_CHIPS.map((p) => (
                  <button key={p} type="button" className={tipChip(tip === p)} aria-pressed={tip === p} onClick={() => setTip(p)}>
                    {`${p}%`}
                  </button>
                ))}
                <button type="button" className={tipChip(tipTyping)} aria-pressed={tipTyping} onClick={() => setTip("other")}>
                  Other
                </button>
              </div>
              <p className="text-muted-foreground mt-2 shrink-0 text-center text-sm tabular-nums" data-guest-bill-tip-sum>
                {tipTyping ? (
                  <>
                    Tip <span className="text-foreground font-semibold">{m(tipCents)}</span> · keypad types the tip
                  </>
                ) : (
                  <>
                    {discountCents > 0 ? (
                      <span data-guest-bill-discount>
                        {discountLabel} −{m(discountCents)} ·{" "}
                      </span>
                    ) : null}
                    Tip {tipOk ? m(tipCents) : "—"} · Total <span className="text-foreground font-semibold">{m(toPayCents + tipCents)}</span>
                  </>
                )}
              </p>
              <div className="mt-2 flex h-60 min-h-40 shrink flex-col">
                <AmountKeypad
                  text={tipTyping ? other : amount}
                  onKey={(k) => (tipTyping ? setOther((t) => pressKey(t, k)) : setAmount((t) => pressKey(t, k)))}
                />
              </div>
            </div>
          </PaySection>
        </div>
        {status}
        <StepFooter strip={1} primary={{ label: "Next", busy, disabled: billCents <= 0 || !tipOk || held, onClick: toMethod }} />
      </>,
      "bill",
    );
  }

  // 3 METHOD: credits, then the rest outside the app.
  if (shown === "method") {
    // Credits cover the bill and the tip: nothing is left for a way, so the
    // button opens the bill (credits are spent). It is money, so › is not
    // offered.
    // Next: Pay (a draft reopened at Method with the way already set).
    const toNext = () => {
      if (way) {
        setMethod(way);
        setStage("pay");
      }
    };
    return frame(
      <>
        {top("How do you pay?")}
        {/* ONE PANEL (MESITA-4077): credits and the way outside the app, then
            what is left to pay. */}
        <StepBody>
          <PaySection title="How you pay" className="text-base">
            <div className="divide-border mt-1 divide-y">
            {spendable > 0 ? (
              <button
                type="button"
                role="switch"
                aria-checked={creditOn}
                onClick={() => setUseCredit((u) => !u)}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
                aria-label={`Credits, ${m(spendable)}`}
                data-guest-credits
              >
                {/* The place's Credits Card, as on the Wallet (MESITA-4085):
                    its image, "Credits", the balance in the black pill. */}
                <span className={LEAD_SLOT}>
                  <CreditsCardChip photo={place.photo} name={place.name} eager />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">Credits</span>
                </span>
                <CreditsPill>{m(spendable)}</CreditsPill>
                <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", creditOn ? "bg-foreground" : "bg-border")} aria-hidden>
                  <span className={cn("bg-card absolute top-0.5 h-5 w-5 rounded-full shadow transition-all", creditOn ? "left-[18px]" : "left-0.5")} />
                </span>
              </button>
            ) : null}
            {/* MESITA-4708: no Card, Apple Pay or Google Pay row for a bill
                (the default way and cash before, MESITA-4617): the rest is
                paid outside the app. */}
            {creditsOnly ? null : (
              <div className="divide-border flex flex-col divide-y" role="radiogroup" aria-label="How you pay">
                {/* Cash in its dollar-bill green (MESITA-4244, Pato: "for
                    cash use green"), the Wallet's Cash chip. */}
                <MethodTile
                  on={way === "cash"}
                  off={cashWhy}
                  lead={<CashChip />}
                  id="cash"
                  title="Pay outside the app"
                  line="Cash or the place's card terminal"
                  onPick={() => setMethod("cash")}
                />
              </div>
            )}
            {creditOn ? <MoneyRow label="Credits" value={`−${m(creditCents)}`} /> : null}
            <MoneyRow label={leftCents === 0 ? "Tip to pay" : "Left to pay"} value={m(dueCents)} strong />
            <a href="/pay" className="block px-4 py-3 text-sm font-semibold underline">Change</a>
            </div>
          </PaySection>
        </StepBody>
        {status}
        <StepFooter
          strip={2}
          primary={
            creditsOnly
              ? { label: "Show the waiter", busy, disabled: held, onClick: () => void openBill(null) }
              : way === "cash"
                ? { label: `Pay ${m(dueCents)} in cash`, busy, disabled: held, onClick: () => void openBill("cash") }
                : { label: "Next", busy, disabled: !way || held, onClick: toNext }
          }
        />
      </>,
      "method",
    );
  }

  // 4 CASH PAY: give the cash, then the QR. The bubble, the amount and the
  // words sit together in the middle.
  return frame(
    <>
      {top("Hand over cash")}
      {/* BIG AND CENTRED (MESITA-4100, Pato: "BIGGER AND CENTERED AND MORE
          BEAUTIFUL ... VERTICALLY CENTERED IN THE BODY ... MAKE THE CIRCLE AND
          THE ICON AND THE INSTRUCTIONS BIGGER"): the panel fills the body and
          holds the bubble, the amount and the two instructions in its middle.
          The amount once (MESITA-4077). */}
      <StepBody className="flex-1">
        <PaySection className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center" data-guest-cash-give>
          <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-green-400 text-neutral-950 shadow-sm ring-8 ring-green-100" aria-hidden>
            <Banknote className="h-14 w-14" strokeWidth={1.75} />
          </span>
          <span className="flex flex-col items-center gap-1">
            <span className="text-muted-foreground text-lg font-semibold">Give the waiter</span>
            <span className="text-4xl font-semibold tabular-nums">{m(dueCents)}</span>
          </span>
          <span className="text-muted-foreground max-w-xs text-lg leading-snug">Then show them your QR so they confirm it.</span>
        </PaySection>
      </StepBody>
      {status}
      <StepFooter strip={3} primary={{ label: "I gave the cash", busy, disabled: held, onClick: () => void openBill("cash") }} />
    </>,
    "cash",
  );
}


/** Method's rows share one leading slot (MESITA-4085), as wide as the
 *  Credits Card image, each mark at its left edge: the marks start on one
 *  edge and the words on another. */
const LEAD_SLOT = "flex w-[3.2rem] shrink-0 items-center";

/** A row in the How you pay panel (MESITA-4072; a bordered tile with a
 *  thick border when chosen until then): the ring on the right fills when
 *  chosen; grey with one line why when the place can't take it. */
function MethodTile({
  id,
  on,
  off,
  lead,
  title,
  line,
  onPick,
}: {
  /** The test hook: "cash". */
  id: string;
  on: boolean;
  off: string | null;
  /** The way's chip, the Wallet's (MESITA-4244): Cash's green. Greyed when
   *  the place can't take it. */
  lead: React.ReactNode;
  title: string;
  line: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-disabled={!!off}
      onClick={() => !off && onPick()}
      className={cn(
        "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition",
        off ? "text-muted-foreground" : "hover:bg-muted/60",
      )}
      data-guest-method={id}
    >
      <span className={cn(LEAD_SLOT, off && "opacity-40 grayscale")}>{lead}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="text-muted-foreground block truncate text-sm">{off ?? line}</span>
      </span>
      {/* The choice is the ring on the right (MESITA-4072: a row in the How
          you pay panel, never a bordered tile inside it). */}
      {!off ? (
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            on ? "bg-foreground text-background" : "border-border border-2",
          )}
          aria-hidden
        >
          {on ? <Check className="h-4 w-4" /> : null}
        </span>
      ) : null}
    </button>
  );
}

/** The bill in bones while the place loads (also the pay pages' loading). */
/** Every Pay loading state: the screen's own header stays, and bones shaped
 *  like the bill fill the body (MESITA-4378, Pato 2026-11-18: every load is
 *  a placeholder; supersedes MESITA-3997's spinner). */
/** STEP 2 WHILE THE PLACE READS (MESITA-4606, Pato: "when you go from 1 to
 *  2 that image is shown. that is wrong"): the Bill step itself in grey,
 *  the amount and the keypad in bones, the steps at 2 and a quiet Next, so
 *  a place picked in step 1 lands on step 2 with nothing in between. The
 *  /pay/place loading frame draws the same body under the same header. */
export function BillStepBones() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-guest-pay="loading" aria-busy aria-label="Loading your bill">
      <div className="flex min-h-0 flex-1 flex-col gap-3 py-4">
        <PaySection title="Bill" className="flex min-h-0 shrink flex-col">
          <div className="flex min-h-0 shrink flex-col px-4 pb-2">
            <Skeleton className="mx-auto mt-3 h-12 w-48 rounded-xl" />
            <div className="mt-4 grid h-64 min-h-44 shrink grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} className="rounded-2xl" />
              ))}
            </div>
          </div>
        </PaySection>
      </div>
      <StepFooter strip={1} primary={{ label: "Next", busy: false, disabled: true, onClick: () => {} }} />
    </div>
  );
}

export function GuestPayLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4" data-guest-pay="loading" aria-busy aria-label="Loading your bill">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="mt-auto h-12 w-full rounded-full" />
    </div>
  );
}

