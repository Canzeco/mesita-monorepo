"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, Check, ChevronRight, Coins, HandCoins, Lock, Plus, ReceiptText, Smartphone, Wallet, XCircle } from "lucide-react";
import { readAmount } from "@mesita/place-profile/lib/money";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiListCards, brandLabel, type SavedCard } from "@/lib/api/cards";
import { AddCardSheet } from "@/components/consumer/AddCardSheet";
import { apiListVisits, apiPayGuest, type PayWith, runBankCheck, TAB_REFUSAL } from "@/lib/api/tab";
import { pickOpenGuestPayment } from "@/lib/pay-open";
import { money, type PayPlace } from "@/lib/api/wallet";
import { acceptCardsAnswer, type CardsLoad, cardsFailure, loadedCards, pickCard } from "@/lib/pay-cards";
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
import { type PadKey, paySplit, pressKey, readTip } from "@/lib/pay-keypad";
import { payPlacePath } from "@/lib/consumer-route-contract";
import { clearSessionHref } from "@/lib/stale-session";
import { cn } from "@/lib/utils";
import { CardBrandChip, cardFace } from "@/components/shared/card-brand-marks";
import { AmountDisplay, AmountKeypad } from "./AmountKeypad";
import { BAD, GOOD, GOOD_TINT, MoneyRow, NOT_PAID_REASON, PlaceBar, PlaceHero, RowsCard, StepBody, StepFooter, StepNav } from "./pay-flow";
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
//             15%, Other) with HandCoins, the Wallet switch "Use my credits"
//             (on by default; credits never pay the tip) and the summary
//             card: Bill, Credits, Left to pay, Tip, Total, and the green
//             Coins line. Nothing left to pay and no tip: straight to Sign.
//   3 Method  App or Cash, one way for everything that's left; the chosen
//             tile has a thick border; the Coins line follows the choice.
//   4A App    the saved card and "Pay MX$X": the card is held, charged when
//             the waiter signs.
//   4B Cash   "Give MX$X to the waiter", then "I gave the cash".
//
// Paying opens the bill (/pay/bill/<id>, GuestTabView: Sign, Confirming,
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
  onOpenPlace,
  registerBack,
  registerClose,
}: {
  placeId: string;
  places: PayPlace[] | null;
  placesFailed: boolean;
  getSupabase: () => Parameters<typeof apiListCards>[0];
  /** The bill exists (or the guest's one open bill): open it. */
  onPaid: (tabId: string) => void;
  /** Open: the search to choose another place. */
  onChoosePlace: () => void;
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
  const [stage, setStage] = useState<Stage>(draft?.stage ?? "bill");
  const [typing, setTyping] = useState(draft?.typing ?? true);
  const [amount, setAmount] = useState(draft?.amount ?? "");
  // A draft from before MESITA-3876 may hold the retired 0 chip: no pick.
  const [tip, setTip] = useState<Tip>(draft && (draft.tip === "other" || TIP_CHIPS.includes(draft.tip as 10)) ? draft.tip : readLastTip(placeId));
  const [other, setOther] = useState(draft?.other ?? "");
  const [useCredit, setUseCredit] = useState(draft?.useCredit ?? true);
  const [method, setMethod] = useState<PayWith | null>(draft?.method ?? null);
  const [cardId, setCardId] = useState<string | null>(draft?.cardId ?? null);
  const [tipSheet, setTipSheet] = useState(false);
  const [otherTyping, setOtherTyping] = useState("");
  const [cardsSheet, setCardsSheet] = useState(false);
  const [cardsLoad, setCardsLoad] = useState<CardsLoad>({ state: "loading" });
  const [cardsAttempt, setCardsAttempt] = useState(0);
  const latestCardsAttempt = useRef(0);
  const [busy, setBusy] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notPaid, setNotPaid] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  // A pay call timed out or lost the network: the bill may be open on the
  // server. Until that same request id answers, Cancel bill and ‹ are locked
  // and nothing mints a new id (MESITA-4061).
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);

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

  const cards = loadedCards(cardsLoad);
  const cardOk = place?.card_ok === true;
  const cashOk = place?.outside_ok === true;
  const spendable = Math.max(place?.available_cents ?? 0, 0);
  const off = !!place && !cardOk && !cashOk && spendable === 0;
  const m = (c: number) => money(c, place?.currency ?? "mxn");
  // The X closes and keeps the ticket (MESITA-3908): Pay shows it, the
  // tabs show the banner. Cancelling is its own button.
  const leave = () => {
    if (busy || addingCard) return;
    onChoosePlace();
  };

  // The saved cards, when the place takes cards (and again on Retry).
  useEffect(() => {
    if (!cardOk) return;
    const attempt = cardsAttempt;
    latestCardsAttempt.current = attempt;
    void apiListCards(getSupabase())
      .then((r) => {
        if (acceptCardsAnswer(attempt, latestCardsAttempt.current)) setCardsLoad({ state: "loaded", cards: r.cards });
      })
      .catch((err: unknown) => {
        if (!acceptCardsAnswer(attempt, latestCardsAttempt.current)) return;
        const failed = cardsFailure(err);
        if (failed.state === "signed_out") window.location.assign(clearSessionHref(payPlacePath(placeId)));
        setCardsLoad(failed);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardOk, cardsAttempt]);

  // The sums.
  const billCents = readAmount(amount) ?? 0;
  const tipCents = tip === null ? 0 : tip === "other" ? readTip(other) ?? 0 : Math.round((billCents * tip) / 100);
  const creditOn = useCredit && spendable > 0;
  const creditCents = creditOn ? Math.min(spendable, billCents) : 0;
  const leftCents = billCents - creditCents;
  const dueCents = leftCents + tipCents;
  const cardMin = place?.card_min_cents ?? 0;
  // Why a tile is grey (one line), null when it can pay what's left.
  const appWhy = !place
    ? null
    : !cardOk
    ? "This place doesn't take cards through Mesita."
    : dueCents > 0 && dueCents < cardMin
    ? leftCents === 0
      ? `Tips under ${m(cardMin)} can't go by card. Set the tip to 0 or tip the waiter outside Mesita.`
      : `Card minimum is ${m(cardMin)}`
    : null;
  const cashWhy = place && !cashOk ? "This place doesn't take cash through Mesita." : null;
  const appOn = !appWhy;
  const cashOn = !cashWhy;
  // The way the bill goes: the guest's pick if it can, else the only one.
  const way: PayWith | null =
    method === "card" && appOn ? "card" : method === "cash" && cashOn ? "cash" : appOn && !cashOn ? "card" : cashOn && !appOn ? "cash" : null;
  const chosenCard = pickCard(cards, cardId);
  const splitFor = (w: PayWith) =>
    place
      ? paySplit({ place, billCents, tipCents, spendableCents: spendable, useCredit: creditOn, restWith: w, tipWith: w, cardId: chosenCard })
      : null;
  const cashbackFor = (w: PayWith) => splitFor(w)?.cashback_cents ?? 0;
  // The Bill's Coins line before a way is chosen: the better of the two.
  const billCashback = way ? cashbackFor(way) : Math.max(appOn ? cashbackFor("card") : 0, cashOn ? cashbackFor("cash") : 0);
  // Each way's rate, from the server (MESITA-4058: always shown, 0% too).
  const rateFor = (w: PayWith) => (w === "card" ? (place?.cashback_bps ?? 0) : (place?.outside_bps ?? 0));
  const billRate = way ? rateFor(way) : Math.max(appOn ? rateFor("card") : 0, cashOn ? rateFor("cash") : 0);

  // Every change is saved, so the X and "Add a card" come back to it.
  useEffect(() => {
    if (sentTabId) return;
    requestId.current = requestIdAfterEdit(requestId.current, outcomeUnknown);
    writeDraft(placeId, { stage, typing, amount, tip, other, useCredit, method, cardId });
  }, [sentTabId, placeId, stage, typing, amount, tip, other, useCredit, method, cardId, outcomeUnknown]);

  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [stage, typing, notPaid]);

  // The header's X leaves (MESITA-3880), with the latest state each render.
  useEffect(() => {
    registerClose?.(leave);
  });
  useEffect(() => () => registerClose?.(null), [registerClose]);

  // One step back: the header's back arrow, the hardware back and ‹ all run
  // this (MESITA-4061). True when it handled it; false on the keypad, where
  // the header goes back in history and the draft stays.
  function backOneStep(): boolean {
    if (busy || addingCard || outcomeUnknown) return true;
    if (notPaid) {
      setNotPaid(null);
      return true;
    }
    if (stage === "pay") setStage(dueCents > 0 ? "method" : "bill");
    else if (stage === "method") setStage("bill");
    else if (!typing) setTyping(true);
    else return false;
    setError(null);
    return true;
  }
  useEffect(() => {
    registerBack?.(backOneStep);
  });
  useEffect(() => () => registerBack?.(null), [registerBack]);

  // Add a card in the app (MESITA-4065: no Stripe page): the card sheet; the
  // saved card becomes the bill's card.
  function addCard() {
    setError(null);
    setCardsSheet(false);
    setAddingCard(true);
  }

  /** Opens the bill: credits only, the card held, or the cash given. */
  async function openBill(w: PayWith | null) {
    if (!place || busy || billCents <= 0) return;
    setBusy(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    const card = w === "card" ? leftCents : 0;
    const cash = w === "cash" ? leftCents : 0;
    try {
      const r = await withinLimit(apiPayGuest(getSupabase(), {
        place_id: placeId,
        bill_cents: billCents,
        request_id: requestId.current,
        credit_cents: creditCents,
        card_bill_cents: card,
        card_tip_cents: w === "card" ? tipCents : 0,
        cash_bill_cents: cash,
        cash_tip_cents: w === "cash" ? tipCents : 0,
        card_pm_id: w === "card" ? chosenCard : null,
      }));
      rememberGuestTab(r.tab_id, r.qr_url);
      writeLastTip(placeId, tip);
      // Start again comes back to the bill with everything typed.
      writeDraft(placeId, { stage: "bill", typing: false, amount, tip, other, useCredit, method, cardId, sentTabId: r.tab_id });
      setOutcomeUnknown(false);
      if (r.card?.status === "requires_action") await runBankCheck(r.card);
      onPaid(r.tab_id);
    } catch (e) {
      const code = e instanceof EFError ? e.code : null;
      if (code) requestId.current = null;
      setOutcomeUnknown(outcomeUnknownAfter(code));
      const openId = code === "too_many_open" && e instanceof EFError ? e.body?.open_tab_id : null;
      if (typeof openId === "string" && openId) {
        onPaid(openId);
        return;
      }
      setBusy(false);
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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <ReceiptText className="h-12 w-12 text-amber-700" aria-hidden />
          <h2 className="font-display mt-4 text-xl font-semibold">Finish this bill first</h2>
          <p className="mt-2 text-base">You have a bill open{blocked.name ? ` at ${blocked.name}` : ""}.</p>
          <p className="text-muted-foreground mt-1 text-sm">Pay it or cancel it before starting another.</p>
        </div>
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
    return <GuestPayLoading />;
  }

  // Desktop keys reach the keypad.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.metaKey || e.ctrlKey || e.altKey || stage !== "bill" || !typing) return;
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
  const held = busy || addingCard;
  // Cancel bill (MESITA-4051, Pato: "two buttons, left is red, next is next
  // step"): every step before the QR ends in it. It throws the draft away
  // here (nothing is held or charged yet) and goes back to Pay. Not while a
  // pay call's outcome is unknown (MESITA-4061): the bill may already be open
  // and the card held; the X still leaves, keeping the draft, and Pay finds
  // the open bill on the way back in.
  const cancelLocked = held || outcomeUnknown;
  const cancelBill = () => {
    if (cancelLocked) return;
    clearGuestDraft(placeId);
    onChoosePlace();
  };
  // The top of every step (MESITA-4061, Pato: "X Pay / Profile Name of place
  // / steps with arrows to nav across them < >"): the place, then the step
  // nav. ‹ is the same step back as the header's back arrow; › only where
  // the footer's button is a plain Next.
  const backArrow = held || outcomeUnknown ? undefined : () => void backOneStep();
  const top = (at: number, onBack: (() => void) | undefined, next?: { onClick: () => void; disabled: boolean }) => (
    <>
      <PlaceBar place={place} onChoose={leave} />
      <StepNav at={at} onBack={onBack} next={next} />
    </>
  );

  // NOT PAID (before the bill opened: the card was refused).
  if (notPaid) {
    return frame(
      <>
        <PlaceBar place={place} />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <XCircle className={cn("h-14 w-14", BAD)} aria-hidden />
          <h2 className="font-display mt-4 text-xl font-semibold">Not paid</h2>
          <p className="mt-2 text-base">{notPaid}</p>
          <p className="text-muted-foreground mt-1 text-sm">Nothing was charged</p>
        </div>
        <StepFooter
          onCancel={cancelBill}
          cancelDisabled={cancelLocked}
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

  // OPEN, OFF: the place doesn't take Mesita payments at all.
  if (off) {
    return frame(
      <>
        <PlaceHero place={place} off onChoose={onChoosePlace} />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <p className="text-base font-semibold">This place doesn&apos;t take Mesita payments.</p>
          <p className="text-muted-foreground mt-1 text-sm">Pay the usual way, outside Mesita.</p>
        </div>
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={onChoosePlace}>
          Choose another place
        </button>
      </>,
      "off",
    );
  }

  // 1 OPEN + 2 BILL, TYPING: the amount and the keypad, together in the
  // middle. The keypad takes the room there is, between 11rem and 16rem, so
  // a short phone (or an error line) shrinks it instead of scrolling.
  if (stage === "bill" && typing) {
    const toTip = () => billCents > 0 && setTyping(false);
    return frame(
      <>
        {top(0, undefined, { onClick: toTip, disabled: billCents <= 0 })}
        <div className="flex min-h-0 flex-1 flex-col justify-center py-4">
          <div className="flex shrink-0 items-center justify-center gap-2">
            <ReceiptText className="text-muted-foreground h-5 w-5" aria-hidden />
            <span className="text-muted-foreground text-sm">The amount on the paper bill</span>
          </div>
          <AmountDisplay text={amount} currency={place.currency} label="Bill" className="mt-1 shrink-0" />
          <div className="mt-4 flex min-h-44 max-h-64 flex-1 flex-col">
            <AmountKeypad text={amount} onKey={(k) => setAmount((t) => pressKey(t, k))} />
          </div>
        </div>
        {status}
        <StepFooter onCancel={cancelBill} cancelDisabled={cancelLocked} primary={{ label: "Next", busy, disabled: billCents <= 0 || held, onClick: toTip }} />
      </>,
      "bill",
    );
  }

  const tipChip = (on: boolean) =>
    cn(
      "flex h-11 flex-1 items-center justify-center rounded-full border text-base font-semibold transition",
      on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
    );

  // 2 TIP: the bill, the tip chips, credits, the summary card.
  if (stage === "bill") {
    const tipOk = tip !== null;
    // Nothing left to pay: this Next opens the bill (credits are spent), so
    // it is money, and › is not offered.
    const toSign = dueCents === 0;
    const tipNext = () => (toSign ? void openBill(null) : setStage("method"));
    return frame(
      <>
        {top(1, backArrow, toSign ? undefined : { onClick: () => setStage("method"), disabled: !tipOk || billCents <= 0 || held })}
        <StepBody className="items-stretch">
          <button
            type="button"
            onClick={() => setTyping(true)}
            className="flex shrink-0 flex-col items-center"
            aria-label={`Bill ${m(billCents)}. Change it`}
            data-guest-bill-amount
          >
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <ReceiptText className="h-4 w-4" aria-hidden />
              Bill
            </span>
            <span className="text-[2.5rem] leading-tight font-semibold tabular-nums">{m(billCents)}</span>
          </button>

          <div className="mt-4 shrink-0 text-left" role="group" aria-label="Tip for the staff">
            <p className="mb-2 flex items-center gap-2 text-base font-semibold">
              <HandCoins className="h-5 w-5" aria-hidden />
              Tip for the staff
            </p>
            <div className="flex gap-2">
              {TIP_CHIPS.map((p) => (
                <button key={p} type="button" className={tipChip(tip === p)} aria-pressed={tip === p} onClick={() => setTip(p)}>
                  {`${p}%`}
                </button>
              ))}
              <button
                type="button"
                className={tipChip(tip === "other")}
                aria-pressed={tip === "other"}
                onClick={() => {
                  setOtherTyping(other);
                  setTipSheet(true);
                }}
              >
                {tip === "other" ? m(tipCents) : "Other"}
              </button>
            </div>
          </div>

          {spendable > 0 ? (
            <button
              type="button"
              role="switch"
              aria-checked={creditOn}
              onClick={() => setUseCredit((u) => !u)}
              className="mt-4 flex min-h-12 w-full shrink-0 items-center gap-3 text-left"
              data-guest-credits
            >
              <Wallet className="h-5 w-5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-base">
                <span className="font-semibold">Use my credits</span>
                <span className="text-muted-foreground"> · {m(spendable)} available</span>
              </span>
              <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", creditOn ? "bg-foreground" : "bg-border")} aria-hidden>
                <span className={cn("bg-card absolute top-0.5 h-5 w-5 rounded-full shadow transition-all", creditOn ? "left-[18px]" : "left-0.5")} />
              </span>
            </button>
          ) : null}

          <RowsCard className="mt-4 shrink-0 text-left">
            <MoneyRow label="Bill" value={m(billCents)} />
            {creditOn ? <MoneyRow label="Credits" value={`−${m(creditCents)}`} /> : null}
            <MoneyRow label="Left to pay" value={m(leftCents)} />
            <MoneyRow label="Tip" value={tipOk ? m(tipCents) : "Choose a tip"} />
            <MoneyRow label="Total" value={m(dueCents)} strong />
            <CashbackRow cents={billCashback} bps={billRate} m={m} />
          </RowsCard>
        </StepBody>
        {status}
        <StepFooter onCancel={cancelBill} cancelDisabled={cancelLocked} primary={{ label: "Next", busy, disabled: !tipOk || billCents <= 0 || held, onClick: tipNext }} />

        <LocalSheet open={tipSheet} onClose={() => setTipSheet(false)} ariaLabel="Another tip">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <p className="flex items-center gap-2 pt-2 text-lg font-semibold">
              <HandCoins className="h-5 w-5" aria-hidden />
              Tip for the staff
            </p>
            <AmountDisplay text={otherTyping} currency={place.currency} label="Tip" className="mt-4 shrink-0" />
            <AmountKeypad text={otherTyping} onKey={(k) => setOtherTyping((t) => pressKey(t, k))} />
            <Button
              type="button"
              size="lg"
              className="mt-3 min-h-12 w-full text-base font-semibold"
              disabled={readTip(otherTyping) === null}
              onClick={() => {
                setOther(otherTyping);
                setTip("other");
                setTipSheet(false);
              }}
            >
              Set tip
            </Button>
          </div>
        </LocalSheet>
      </>,
      "review",
    );
  }

  // 3 METHOD: App or Cash for everything that's left.
  if (stage === "method") {
    const toPay = () => {
      if (way) {
        setMethod(way);
        setStage("pay");
      }
    };
    return frame(
      <>
        {top(2, backArrow, { onClick: toPay, disabled: !way || held })}
        <StepBody className="items-stretch">
          <p className="shrink-0 text-center">
            <span className="text-muted-foreground block text-sm">{leftCents === 0 ? "Tip to pay" : "Left to pay"}</span>
            <span className="block text-[2.5rem] leading-tight font-semibold tabular-nums">{m(dueCents)}</span>
          </p>
          <div className="mt-4 flex shrink-0 flex-col gap-3 text-left" role="radiogroup" aria-label="How you pay">
            <MethodTile
              on={way === "card"}
              off={appWhy}
              icon={<Smartphone />}
              tone="bg-pink-gradient text-white"
              title="App"
              line="Card"
              bps={rateFor("card")}
              onPick={() => setMethod("card")}
            />
            <MethodTile
              on={way === "cash"}
              off={cashWhy}
              icon={<Banknote />}
              tone="bg-green-400 text-neutral-950"
              title="Cash"
              line="Cash or their terminal"
              bps={rateFor("cash")}
              onPick={() => setMethod("cash")}
            />
          </div>
          <p
            className={cn("mt-4 flex shrink-0 items-center justify-center gap-2 text-base font-semibold", way && cashbackFor(way) > 0 ? GOOD : "text-muted-foreground")}
            data-guest-cashback
          >
            <Coins className="h-5 w-5" aria-hidden />
            {way
              ? cashbackFor(way) > 0
                ? `+${m(cashbackFor(way))} · ${backAsCredits(rateFor(way))}`
                : backAsCredits(rateFor(way))
              : "Choose how to pay"}
          </p>
        </StepBody>
        {status}
        <StepFooter onCancel={cancelBill} cancelDisabled={cancelLocked} primary={{ label: "Next", busy, disabled: !way || held, onClick: toPay }} />
      </>,
      "method",
    );
  }

  // 4A APP PAY: the saved card, "Pay MX$X", held now. Pay moves money and
  // "Add a card" leaves the app: neither is offered as ›.
  if (way === "card") {
    const card = cards?.find((c) => c.id === chosenCard) ?? null;
    const guestFace = card ? cardFace(card.brand, brandLabel(card.brand)) : null;
    const cardsUnknown = cards === null;
    return frame(
      <>
        {top(3, backArrow)}
        <StepBody>
          {cardsUnknown ? (
            cardsLoad.state === "failed" ? (
              <button type="button" className="text-base font-semibold underline" onClick={() => {
                setCardsLoad({ state: "loading" });
                setCardsAttempt((n) => n + 1);
              }}>
                Couldn&apos;t load your cards. Retry
              </button>
            ) : (
              <Skeleton className="h-28 w-48 rounded-2xl" />
            )
          ) : card ? (
            <button
              type="button"
              onClick={() => setCardsSheet(true)}
              className={cn("flex h-28 w-48 flex-col justify-between rounded-2xl p-4 text-left", guestFace?.className)}
              style={guestFace?.style}
              aria-label={`${brandLabel(card.brand)} ending ${card.last4}. Change card`}
              data-guest-card
            >
              {guestFace?.mark}
              <span className="text-base font-semibold tracking-widest tabular-nums">•••• {card.last4}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => addCard()}
              disabled={addingCard}
              className="border-muted-foreground/40 text-muted-foreground flex h-28 w-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed"
              data-guest-add-card
            >
              <Plus className="h-6 w-6" aria-hidden />
              <span className="text-base font-semibold">{"Add a card"}</span>
            </button>
          )}
          {cards && cards.length > 1 ? (
            <button type="button" className="text-muted-foreground mt-2 flex h-11 items-center gap-1 text-sm font-semibold" onClick={() => setCardsSheet(true)}>
              Change card
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <p className="text-muted-foreground mt-4 flex items-center justify-center gap-2 text-sm">
            <Lock className="h-4 w-4" aria-hidden />
            Held now, charged when the waiter signs.
          </p>
        </StepBody>
        {status}
        <StepFooter
          onCancel={cancelBill}
          cancelDisabled={cancelLocked}
          primary={
            card
              ? { label: `Pay ${m(dueCents)}`, busy, disabled: held, onClick: () => void openBill("card") }
              : { label: "Add a card", busy, disabled: cardsUnknown || held, onClick: () => addCard() }
          }
        />

        <LocalSheet open={cardsSheet} onClose={() => setCardsSheet(false)} ariaLabel="Your cards">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <p className="pt-2 pb-3 text-lg font-semibold">Your cards</p>
            <RowsCard>
              {(cards ?? []).map((c: SavedCard) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex min-h-14 items-center justify-between gap-3 px-4 text-left"
                  onClick={() => {
                    setCardId(c.id);
                    setCardsSheet(false);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <CardBrandChip brand={c.brand} last4={c.last4} />
                    <span className="truncate text-base font-semibold">
                      {brandLabel(c.brand)} •••• {c.last4}
                    </span>
                  </span>
                  {c.id === chosenCard ? <Check className="h-5 w-5" aria-hidden /> : null}
                </button>
              ))}
              {(cards ?? []).length < 3 ? (
                <button type="button" className="flex min-h-14 items-center gap-3 px-4 text-left text-base font-semibold" onClick={() => addCard()}>
                  <Plus className="h-5 w-5" aria-hidden />
                  Add a card
                </button>
              ) : null}
            </RowsCard>
          </div>
        </LocalSheet>
        <AddCardSheet
          open={addingCard}
          onClose={() => setAddingCard(false)}
          knownCardIds={(cards ?? []).map((c) => c.id)}
          onSaved={(id) => {
            setAddingCard(false);
            setCardId(id);
            setCardsLoad({ state: "loading" });
            setCardsAttempt((n) => n + 1);
          }}
        />
      </>,
      "app",
    );
  }

  // 4B CASH PAY: give the cash, then the QR. The bubble, the amount and the
  // words sit together in the middle.
  return frame(
    <>
      {top(3, backArrow)}
      <StepBody>
        <span className="flex h-28 w-28 items-center justify-center rounded-full bg-green-400 text-neutral-950" aria-hidden>
          <Banknote className="h-14 w-14" />
        </span>
        <p className="mt-6 text-[2.5rem] leading-tight font-semibold tabular-nums">{m(dueCents)}</p>
        <h2 className="font-display mt-1 text-xl font-semibold">Give {m(dueCents)} to the waiter</h2>
        <p className="text-muted-foreground mt-1 text-sm">Then show them the QR</p>
      </StepBody>
      {status}
      <StepFooter onCancel={cancelBill} cancelDisabled={cancelLocked} primary={{ label: "I gave the cash", busy, disabled: held, onClick: () => void openBill("cash") }} />
    </>,
    "cash",
  );
}

/** "5% back as credits", "0% back as credits" (MESITA-4058, Pato: "if no
 *  cashback still mention 0% back and always mention the back as credits"). */
function backAsCredits(bps: number) {
  return `${bps / 100}% back as credits`;
}

/** The summary's last row: the green Coins line, or the muted 0% one. */
function CashbackRow({ cents, bps, m }: { cents: number; bps: number; m: (c: number) => string }) {
  return cents > 0 ? (
    <div className={cn("flex min-h-11 items-center gap-3 px-4 font-semibold", GOOD, GOOD_TINT)} data-guest-cashback>
      <Coins className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1">+{m(cents)} back as credits</span>
    </div>
  ) : (
    <div className="text-muted-foreground flex min-h-11 items-center gap-3 px-4" data-guest-cashback>
      <Coins className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1">{backAsCredits(bps)}</span>
    </div>
  );
}

/** A large tile for App or Cash: thick border when chosen, grey with one
 *  line why when the place can't take it. */
function MethodTile({
  on,
  off,
  icon,
  tone,
  title,
  line,
  bps,
  onPick,
}: {
  on: boolean;
  off: string | null;
  icon: React.ReactNode;
  /** The way's own colour (MESITA-3877): App the brand pink, Cash the
   *  Wallet's Cash green. Grey when the place can't take it. */
  tone: string;
  title: string;
  line: string;
  /** The way's cashback rate; 0 shows as a muted "0% back as credits". */
  bps: number;
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
        "relative flex min-h-24 w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition",
        off ? "bg-muted border-border text-muted-foreground border" : on ? "border-foreground border-[3px]" : "border-border hover:bg-muted/60 border",
      )}
      data-guest-method={title.toLowerCase()}
    >
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full [&>svg]:h-6 [&>svg]:w-6", off ? "bg-card" : tone)} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="text-muted-foreground block text-sm">{off ?? line}</span>
      </span>
      {!off ? (
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap", bps > 0 ? [GOOD, GOOD_TINT] : "bg-muted text-muted-foreground")}>
          {backAsCredits(bps)}
        </span>
      ) : null}
      {on ? (
        <span className="bg-foreground text-background absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full" aria-hidden>
          <Check className="h-4 w-4" />
        </span>
      ) : null}
    </button>
  );
}

/** The bill in bones while the place loads (also the pay pages' loading). */
/** Every Pay loading state (MESITA-3997, Pato: "the loading should not look
 *  like that"): the screen's own header stays, and one small spinner sits in
 *  the middle. No grey bones. */
export function GuestPayLoading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center" data-guest-pay="loading" aria-busy>
      <Spinner size="md" label="Loading your bill" />
    </div>
  );
}
