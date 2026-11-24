"use client";

import { useEffect, useRef, useState } from "react";
import { ReceiptText, XCircle } from "lucide-react";
import { readAmount } from "@mesita/place-profile/lib/money";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiListVisits, apiPayGuest, TAB_REFUSAL } from "@/lib/api/tab";
import { pickOpenGuestPayment } from "@/lib/pay-open";
import { discountOf, money, type PayPlace, payPlaceCashbackBps, payPlaceDiscountBps } from "@/lib/api/wallet";
import { closeAction } from "@/lib/guest-pay-stages";
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
  writeDraft,
  writeLastTip,
} from "@/lib/guest-pay-draft";
import { trackEvent } from "@/lib/analytics/track";
import { type PadKey, pressKey, readTip } from "@/lib/pay-keypad";
import { cn } from "@/lib/utils";
import { AmountDisplay, AmountKeypad } from "./AmountKeypad";
import { BAD, BOX_TINT, NOT_PAID_REASON, PaySection, PayTitle, PlaceHero, StepBody, StepFooter } from "./pay-flow";
import { NETWORK_FAILURE, QUIET_BUTTON_CLASS, rememberGuestTab } from "./pay-common";

// THE GUEST PAYS (MESITA-3861), at /pay/place/<placeId>. THREE STEPS (Pato,
// 2026-11-23, MESITA-4813: "Yes, cut to three"): Bill · Show waiter · Receipt.
// This screen is Bill, whole: the amount and the tip on the keypad, then what
// it comes to (the Discount or the Cashback, the Credits switch, You pay), and
// "Show the waiter" opens the bill at once. Method and "Hand over cash" left:
// the one way for the rest is outside the app (cash or the place's own card
// terminal), so there was nothing to choose.
//
// Credits are on by default, every time the bill opens (MESITA-4100), and
// never pay the tip. A place that takes nothing outside the app takes credits
// alone: no tip, and the screen says so before anything is typed.
//
// Paying opens the bill (/pay/bill/<id>, GuestTabView: Show waiter,
// Confirming, Receipt, Not paid). ONE TICKET AT A TIME (MESITA-3879): a bill
// already open on the server comes first. What is typed lives in memory for 30
// minutes. Every rule and peso is the server's; this screen proposes.

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
  const [amount, setAmount] = useState(draft?.amount ?? "");
  // A draft from before MESITA-3876 may hold the retired 0 chip: no pick.
  const [tip, setTip] = useState<Tip>(draft && (draft.tip === "other" || TIP_CHIPS.includes(draft.tip as 10)) ? draft.tip : readLastTip(placeId));
  const [other, setOther] = useState(draft?.other ?? "");
  // Credits are on by default, every time the bill opens (MESITA-4100,
  // Pato: "PAY WITH CREDITS MUST BE SELECTED AS DEFAULT"): a switch turned
  // off is not carried over from a saved draft.
  const [useCredit, setUseCredit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notPaid, setNotPaid] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  // A pay call timed out or lost the network: the bill may be open on the
  // server. Until that same request id answers, ‹ is locked
  // and nothing mints a new id (MESITA-4061).
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
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
  // MESITA-4600: the rule lives in closeAction (pinned by a test).
  const closeFlow = () => {
    const act = closeAction({ busy, billOpen: outcomeUnknown });
    if (act === "ignore") return;
    if (act === "discard") clearGuestDraft(placeId);
    onLeavePay();
  };

  // The sums. MESITA-4770: a visit Discount comes off the printed bill before
  // credit and cash split what is left; the tip is on the printed bill. The
  // server works out the same and answers discount_changed with its own
  // numbers when they differ (serverDiscountBps then wins).
  const billCents = readAmount(amount) ?? 0;
  const tipCents = !cashOk || tip === null ? 0 : tip === "other" ? readTip(other) ?? 0 : Math.round((billCents * tip) / 100);
  const discountBps = serverDiscountBps ?? payPlaceDiscountBps(place);
  const discountCents = discountOf(billCents, discountBps);
  const toPayCents = billCents - discountCents;
  const cashbackBps = discountBps > 0 ? 0 : payPlaceCashbackBps(place);
  // Credits are the only way where nothing is taken outside the app.
  const creditOn = (useCredit || !cashOk) && spendable > 0;
  const creditCents = creditOn ? Math.min(spendable, toPayCents) : 0;
  const leftCents = toPayCents - creditCents;
  const dueCents = leftCents + tipCents;
  // Cashback is on what is paid outside the app: never on credits or the tip
  // (pay_tab_grant_cashback).
  const cashbackCents = discountOf(leftCents, cashbackBps);
  // Nothing outside the app here and the credits fall short: no way to pay.
  const short = !cashOk && leftCents > 0;

  // Every change is saved, so ← from the QR comes back to it.
  useEffect(() => {
    if (sentTabId) return;
    requestId.current = requestIdAfterEdit(requestId.current, outcomeUnknown);
    writeDraft(placeId, { amount, tip, other, useCredit });
  }, [sentTabId, placeId, amount, tip, other, useCredit, outcomeUnknown]);

  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [notPaid]);

  // Which step the guest reached (MESITA-4124).
  useEffect(() => {
    trackEvent(getSupabase(), "pay_step_view", { step: "bill" });
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // ← reopens the places (MESITA-4598).
    leave();
    return true;
  }
  useEffect(() => {
    registerBack?.(backOneStep);
  });
  useEffect(() => () => registerBack?.(null), [registerBack]);

  /** Opens the bill: the credits, and the rest outside the app. */
  async function openBill() {
    if (!place || busy || billCents <= 0 || short) return;
    setBusy(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const r = await withinLimit(apiPayGuest(getSupabase(), {
        place_id: placeId,
        bill_cents: billCents,
        request_id: requestId.current,
        credit_cents: creditCents,
        cash_bill_cents: leftCents,
        cash_tip_cents: tipCents,
      }));
      if (!r.tab_id) {
        setBusy(false);
        setError("The payment is still going through.");
        return;
      }
      rememberGuestTab(r.tab_id, r.qr_url);
      writeLastTip(placeId, tip);
      // Start again comes back to the bill with everything typed.
      writeDraft(placeId, { amount, tip, other, useCredit, sentTabId: r.tab_id });
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

  // The keypad types the bill, or the tip while Other is picked.
  const tipTyping = cashOk && tip === "other";
  const type = (k: PadKey) => (tipTyping ? setOther((t) => pressKey(t, k)) : setAmount((t) => pressKey(t, k)));

  // Desktop keys reach the keypad.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.metaKey || e.ctrlKey || e.altKey || busy || notPaid) return;
    const key: PadKey | null = /^[0-9]$/.test(e.key) ? (e.key as PadKey) : e.key === "." ? "." : e.key === "Backspace" ? "back" : null;
    if (key) {
      e.preventDefault();
      type(key);
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
            },
          }}
        />
      </>,
      "not-paid",
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
      "flex h-11 flex-1 items-center justify-center rounded-full [@media(max-height:620px)]:h-9 border text-base font-semibold transition",
      on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
    );

  // BILL (MESITA-4619's one screen, MESITA-4813's whole step): the typed bill
  // big on top, the tip chips, the summary, the keypad, "Show the waiter".
  const tipOk = !cashOk || tip !== null;
  const pct = (bps: number) => `${bps / 100}%`;
  const offer =
    discountBps > 0
      ? { label: `${pct(discountBps)} Discount`, value: `−${m(discountCents)}`, tone: BOX_TINT.discount }
      : cashbackBps > 0 && cashOk
        ? { label: `${pct(cashbackBps)} Cashback`, value: `+${m(cashbackCents)}`, tone: BOX_TINT.cashback }
        : null;
  return frame(
    <>
      {top("How much was your bill?")}
      <div className="scrollbar-thin-dark -mx-4 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3 [@media(max-height:620px)]:py-1.5">
        <PaySection className="flex min-h-full shrink-0 flex-col">
          <div className="flex flex-1 flex-col px-4 pt-2 pb-2">
            <AmountDisplay text={amount} currency={place.currency} label="Bill" className="shrink-0 [@media(max-height:620px)]:h-10" />
            {cashOk ? (
              <div className="mt-2 flex shrink-0 gap-2" role="group" aria-label="Tip">
                {TIP_CHIPS.map((p) => (
                  <button key={p} type="button" className={tipChip(tip === p)} aria-pressed={tip === p} onClick={() => setTip(p)}>
                    {`${p}%`}
                  </button>
                ))}
                <button type="button" className={tipChip(tipTyping)} aria-pressed={tipTyping} onClick={() => setTip("other")}>
                  Other
                </button>
              </div>
            ) : (
              <p className="text-muted-foreground mt-1 shrink-0 text-center text-sm" data-guest-credits-only>
                This place only takes your credits on Mesita. Pay the tip to the waiter.
              </p>
            )}
            <div className="mt-2 flex shrink-0 flex-col gap-1" data-guest-summary>
              {offer ? (
                <div className={cn("flex min-h-8 [@media(max-height:620px)]:min-h-7 items-center justify-between gap-3 rounded-lg px-2.5 text-sm font-semibold tabular-nums", offer.tone)} data-guest-offer>
                  <span className="truncate">{offer.label}</span>
                  <span className="shrink-0">{offer.value}</span>
                </div>
              ) : null}
              {spendable > 0 ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={creditOn}
                  disabled={!cashOk || busy}
                  onClick={() => setUseCredit((u) => !u)}
                  className="flex min-h-11 w-full items-center gap-3 px-2.5 text-left text-sm [@media(max-height:620px)]:min-h-9 tabular-nums"
                  aria-label={`Use credits, ${m(spendable)} available`}
                  data-guest-credits
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">Credits</span> <span className="text-muted-foreground">{m(spendable)}</span>
                  </span>
                  <span className="shrink-0 font-semibold">−{m(creditCents)}</span>
                  {cashOk ? (
                    <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", creditOn ? "bg-foreground" : "bg-border")} aria-hidden>
                      <span className={cn("bg-card absolute top-0.5 h-5 w-5 rounded-full shadow transition-all", creditOn ? "left-[18px]" : "left-0.5")} />
                    </span>
                  ) : null}
                </button>
              ) : null}
              <div className="flex min-h-9 items-center justify-between gap-3 px-2.5 tabular-nums [@media(max-height:620px)]:min-h-8" data-guest-you-pay>
                <span className="min-w-0 truncate text-sm">
                  <span className="text-base font-semibold">You pay</span>
                  {cashOk ? <span className={tipTyping ? "font-semibold" : "text-muted-foreground"}> {tip === null ? "· pick a tip" : `· tip ${m(tipCents)}`}</span> : null}
                </span>
                <span className="shrink-0 text-lg font-semibold">{m(dueCents)}</span>
              </div>
            </div>
            <div className="mt-1 flex h-44 max-h-60 shrink-0 grow flex-col [@media(max-height:620px)]:h-40 [@media(max-height:620px)]:[&>*]:grid-rows-[repeat(4,minmax(2.5rem,1fr))]">
              <AmountKeypad text={tipTyping ? other : amount} onKey={type} />
            </div>
          </div>
        </PaySection>
      </div>
      {status ??
        (short && billCents > 0 ? (
          <p className="text-destructive shrink-0 pt-2 text-center text-sm" role="alert" data-guest-short>
            Your credits don&apos;t cover this bill.
          </p>
        ) : null)}
      <StepFooter strip={1} primary={{ label: "Show the waiter", busy, disabled: billCents <= 0 || !tipOk || short || held, onClick: () => void openBill() }} />
    </>,
    "bill",
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
      <StepFooter strip={1} primary={{ label: "Show the waiter", busy: false, disabled: true, onClick: () => {} }} />
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

