"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, Check, Coins, Lock, Plus, ReceiptText, Smartphone, XCircle } from "lucide-react";
import { readAmount } from "@mesita/place-profile/lib/money";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { LocalDialog, LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiListCards, brandLabel, type SavedCard } from "@/lib/api/cards";
import { useAddCardPage } from "@/lib/added-card";
import { apiListVisits, apiPayGuest, type PayWith, runBankCheck, TAB_REFUSAL } from "@/lib/api/tab";
import { pickOpenGuestPayment } from "@/lib/pay-open";
import { money, type PayPlace } from "@/lib/api/wallet";
import { acceptCardsAnswer, type CardsLoad, cardsFailure, loadedCards, pickCard } from "@/lib/pay-cards";
import { guardStage, initialStage, payBackStage, payNextStage, STEP, skippedSegments } from "@/lib/guest-pay-stages";
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
import { CASH_GREEN, CreditsCardChip, CreditsPill } from "@/components/consumer/wallet/WalletLists";
import { BAD, MoneyRow, NOT_PAID_REASON, PayTop, PaySection, PlaceHero, StepBody, StepFooter } from "./pay-flow";
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
//             left, then App or Cash, one way for all of it; the chosen tile
//             has a thick border; the Coins line follows the choice. Credits
//             cover everything and no tip: "Pay with credits" opens the bill.
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
/** Refusals that mean this card, not the bill: it is never preselected again. */
const CARD_REFUSED = new Set(["card_declined", "card_needs_auth", "card_failed", "card_not_found", "locked"]);
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
  // A draft at Card or Pay with credits off starts at Method (MESITA-4117):
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
  const [cardId, setCardId] = useState<string | null>(draft?.cardId ?? null);
  // The card the bank just refused: listed, never preselected (MESITA-4117).
  const [refusedCardId, setRefusedCardId] = useState<string | null>(draft?.refusedCardId ?? null);
  const [tipSheet, setTipSheet] = useState(false);
  const [otherTyping, setOtherTyping] = useState("");
  const [cardsLoad, setCardsLoad] = useState<CardsLoad>({ state: "loading" });
  const [cardsAttempt, setCardsAttempt] = useState(0);
  const latestCardsAttempt = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notPaid, setNotPaid] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  // A pay call timed out or lost the network: the bill may be open on the
  // server. Until that same request id answers, Cancel bill and ‹ are locked
  // and nothing mints a new id (MESITA-4061).
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  // Cancel bill asks first (MESITA-4068, Pato: "ask confirmation to cancel bill").
  const [confirmCancel, setConfirmCancel] = useState(false);

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
    if (busy) return;
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
  const chosenCard = pickCard(cards, cardId, refusedCardId);
  const creditsOnly = dueCents === 0;
  // The step shown (MESITA-4117): a stored or live stage that stopped making
  // sense goes back to Method, or to Card when no card can be charged. Pure,
  // so nothing sets state while rendering.
  const shown = guardStage({ stage, method, way, dueCents, cardMissing: cards !== null && !chosenCard });
  const splitFor = (w: PayWith) =>
    place
      ? paySplit({ place, billCents, tipCents, spendableCents: spendable, useCredit: creditOn, restWith: w, tipWith: w, cardId: chosenCard })
      : null;
  const cashbackFor = (w: PayWith) => splitFor(w)?.cashback_cents ?? 0;
  // What the way's own part earns, the credit part apart (MESITA-4100).
  const wayBackFor = (w: PayWith) => {
    const sp = splitFor(w);
    return (w === "card" ? sp?.card_back_cents : sp?.cash_back_cents) ?? 0;
  };
  // Each way's rate, from the server (MESITA-4058: always shown, 0% too).
  const rateFor = (w: PayWith) => (w === "card" ? (place?.cashback_bps ?? 0) : (place?.outside_bps ?? 0));

  // Every change is saved, so the X and "Add a card" come back to it.
  useEffect(() => {
    if (sentTabId) return;
    requestId.current = requestIdAfterEdit(requestId.current, outcomeUnknown);
    writeDraft(placeId, { stage: shown, typing, amount, tip, other, useCredit, method, cardId, refusedCardId });
  }, [sentTabId, placeId, shown, typing, amount, tip, other, useCredit, method, cardId, refusedCardId, outcomeUnknown]);

  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [shown, typing, notPaid]);

  // The header's X leaves (MESITA-3880), with the latest state each render.
  useEffect(() => {
    registerClose?.(leave);
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
    if (shown === "pay" || shown === "card" || shown === "method") setStage(payBackStage(shown, way));
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
  // Its own page since MESITA-4101 (/wallet/cards/new): back here, the saved
  // card becomes the bill's card. The draft survives the trip.
  const openAddCard = useAddCardPage((id) => {
    setCardId(id);
    setCardsLoad({ state: "loading" });
    setCardsAttempt((n) => n + 1);
  });
  function addCard() {
    setError(null);
    openAddCard();
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
      // Start again comes back to the bill with everything typed; the draft
      // keeps the card actually charged, not only one the guest tapped.
      writeDraft(placeId, { stage: "bill", typing: false, amount, tip, other, useCredit, method, cardId: w === "card" ? chosenCard : cardId, refusedCardId, sentTabId: r.tab_id });
      setOutcomeUnknown(false);
      if (r.card?.status === "requires_action") await runBankCheck(r.card);
      onPaid(r.tab_id);
    } catch (e) {
      const code = e instanceof EFError ? e.code : null;
      if (code) requestId.current = null;
      // The bank refused this card: never its default again (MESITA-4117).
      if (w === "card" && code && CARD_REFUSED.has(code)) setRefusedCardId(chosenCard);
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
        <StepBody>
          <PaySection className="flex flex-col items-center p-4 text-center">
            <ReceiptText className="h-10 w-10 text-amber-700" aria-hidden />
            <h2 className="font-display mt-2 text-xl font-semibold">Finish this bill first</h2>
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
    return <GuestPayLoading />;
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
      <LocalDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} ariaLabel="Cancel this bill">
        <div className="p-5">
          <p className="text-base font-semibold">Cancel this bill?</p>
          {/* Before the bill opens nothing has moved (MESITA-4106). */}
          <p className="text-muted-foreground mt-1 text-sm">Nothing is paid. Your credits stay in your Wallet.</p>
          <div className="mt-4 flex gap-2">
            <Button className="min-h-12 flex-1 text-base font-semibold" disabled={cancelLocked} onClick={cancelBill}>
              Cancel bill
            </Button>
            <button type="button" className={cn(QUIET_BUTTON_CLASS, "flex-1")} onClick={() => setConfirmCancel(false)}>
              Keep it
            </button>
          </div>
        </div>
      </LocalDialog>
    </div>
  );
  // Under the body, over the footer; cleared on every step change.
  const status = error ? (
    <p className="text-destructive shrink-0 pt-2 text-center text-sm" role="alert">
      {error}
    </p>
  ) : null;
  const held = busy;
  // Cancel bill (MESITA-4051, Pato: "two buttons, left is red, next is next
  // step"): every step before the QR ends in it. It throws the draft away
  // here (nothing is held or charged yet) and goes back to Pay. Not while a
  // pay call's outcome is unknown (MESITA-4061): the bill may already be open
  // and the card held; the X still leaves, keeping the draft, and Pay finds
  // the open bill on the way back in.
  const cancelLocked = held || outcomeUnknown;
  const askCancel = () => {
    if (!cancelLocked) setConfirmCancel(true);
  };
  const cancelBill = () => {
    if (cancelLocked) return;
    setConfirmCancel(false);
    clearGuestDraft(placeId);
    onChoosePlace();
  };
  // The top of every step (MESITA-4061, Pato: "X Pay / Profile Name of place
  // / steps with arrows to nav across them < >"): the place, then the step
  // nav. ‹ is the same step back as the header's back arrow; › only where
  // the footer's button is a plain Next.
  const backArrow = held || outcomeUnknown ? undefined : () => void backOneStep();
  const top = (at: number, onBack: (() => void) | undefined, next?: { onClick: () => void; disabled: boolean }, skipped?: number[]) => (
    <PayTop place={place} onChoose={leave} step={{ at, onBack, next, skipped }} />
  );

  // NOT PAID (before the bill opened: the card was refused).
  if (notPaid) {
    return frame(
      <>
        <PayTop place={place} />
        <StepBody>
          <PaySection className="flex flex-col items-center p-4 text-center">
            <XCircle className={cn("h-10 w-10", BAD)} aria-hidden />
            <h2 className="font-display mt-2 text-xl font-semibold">Not paid</h2>
            <p className="mt-2 text-base">{notPaid}</p>
            <p className="text-muted-foreground mt-1 text-sm">Nothing was charged</p>
          </PaySection>
        </StepBody>
        <StepFooter
          onCancel={askCancel}
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

  // 1 OPEN + 2 BILL, TYPING: the amount and the keypad, together in the
  // middle. The keypad takes the room there is, between 11rem and 16rem, so
  // a short phone (or an error line) shrinks it instead of scrolling.
  if (shown === "bill" && typing) {
    const toTip = () => billCents > 0 && setTyping(false);
    return frame(
      <>
        {/* ‹ leaves to the places (MESITA-4117), keeping the draft. */}
        {top(STEP.bill, held ? undefined : leave, { onClick: toTip, disabled: billCents <= 0 })}
        {/* The bill's panel (MESITA-4072), at the top (MESITA-4077): one
            row, "Bill" and the typed amount on its right (MESITA-4082, no
            big display), then the keypad. A short phone shrinks the keys
            instead of scrolling. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 py-4">
          {/* THE ASK (MESITA-4104, Pato: "just for the first step, make this
              clearer ... say how much was your bill ... maybe even use an
              icon"): one row under the step bar, the Bill step only. */}
          <PaySection className="flex items-center gap-3 px-4 py-3" data-bill-ask>
            <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-hidden>
              <ReceiptText className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold">How much was your bill?</span>
              <span className="text-muted-foreground block text-sm">Type the total on your ticket.</span>
            </span>
          </PaySection>
          {/* THE AMOUNT, BIG AND CENTRED (MESITA-4125, Pato: "the bill amount
              must be bigger ... bigger and centralized"): AmountDisplay over
              the keypad, undoing MESITA-4082's small amount on the right. */}
          <PaySection title="Bill" className="flex min-h-0 shrink flex-col">
            <div className="flex min-h-0 shrink flex-col px-4 pb-2">
              <AmountDisplay text={amount} currency={place.currency} label="Bill" className="mt-1 shrink-0" />
              <div className="mt-2 flex h-64 min-h-44 shrink flex-col">
                <AmountKeypad text={amount} onKey={(k) => setAmount((t) => pressKey(t, k))} />
              </div>
            </div>
          </PaySection>
        </div>
        {status}
        <StepFooter onCancel={askCancel} cancelDisabled={cancelLocked} primary={{ label: "Next", busy, disabled: billCents <= 0 || held, onClick: toTip }} />
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
  if (shown === "bill") {
    const tipOk = tip !== null;
    const tipNext = () => setStage("method");
    return frame(
      <>
        {top(STEP.tip, backArrow, { onClick: tipNext, disabled: !tipOk || billCents <= 0 || held })}
        {/* ONE PANEL (MESITA-4077): the tip choices, then Bill · Tip · Total.
            The Bill row opens the keypad again; what it earns is on Method. */}
        <StepBody>
          <PaySection title="Tip" className="text-base">
            <div className="flex gap-2 px-4 pt-3 pb-4" role="group" aria-label="Tip">
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
            <div className="divide-border border-border divide-y border-t">
              <button type="button" onClick={() => setTyping(true)} className="hover:bg-muted/60 block w-full text-left transition" aria-label={`Bill ${m(billCents)}. Change it`} data-guest-bill-amount>
                <MoneyRow label="Bill" value={m(billCents)} />
              </button>
              <MoneyRow label="Tip" value={tipOk ? m(tipCents) : "—"} />
              <MoneyRow label="Total" value={m(billCents + tipCents)} strong />
            </div>
          </PaySection>
        </StepBody>
        {status}
        <StepFooter onCancel={askCancel} cancelDisabled={cancelLocked} primary={{ label: "Next", busy, disabled: !tipOk || billCents <= 0 || held, onClick: tipNext }} />

        <LocalSheet open={tipSheet} onClose={() => setTipSheet(false)} ariaLabel="Another tip">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <p className="pt-2 text-lg font-semibold">Tip</p>
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

  // The bill's card, picked on Card (MESITA-4117) and shown again on Pay.
  const card = cards?.find((c) => c.id === chosenCard) ?? null;
  const cardsUnknown = cards === null;
  const retryCards = () => {
    setCardsLoad({ state: "loading" });
    setCardsAttempt((n) => n + 1);
  };
  // What this payment earns, one wording at zero (MESITA-4117, Pato: "IF NO
  // CASHBACK MENTION (0% Back)").
  const backText = (cents: number) => (cents > 0 ? `+${m(cents)} back as credits` : "0% back");

  // 3 METHOD: App or Cash for everything that's left.
  if (shown === "method") {
    // Credits cover the bill and the tip: nothing is left for a way, so the
    // button opens the bill (credits are spent). It is money, so › is not
    // offered.
    // What each way earns, in a box on its row (MESITA-4100, Pato: "THE
    // CASHBACK AMOUNT IS SUPER IMPORTANT ... IN A BOX WITH COLOR"): green
    // with the amount when it earns, grey "0% back" when it does not.
    // Credits earn too where the place gives it (MESITA-3827): their own box.
    const backBox = (bps: number, cents: number) => {
      const rate = `${bps / 100}% back`;
      return { text: cents > 0 ? `${rate} · +${m(cents)}` : rate, good: cents > 0 };
    };
    const backLine = (w: PayWith) => backBox(rateFor(w), wayBackFor(w));
    const creditBack = backBox(place.credit_bps ?? 0, splitFor(way ?? "card")?.credit_back_cents ?? 0);
    // Everything this payment earns: the way's part plus the credit part.
    const chosenBack = cashbackFor(way ?? "card");
    // Next: Card for the card way, Pay for cash (MESITA-4117).
    const toNext = () => {
      if (way) {
        setMethod(way);
        setStage(payNextStage(way));
      }
    };
    // Card turns skipped as soon as the way is cash or credits cover it.
    const skipped = skippedSegments({ way, creditsOnly });
    return frame(
      <>
        {top(STEP.method, backArrow, creditsOnly ? undefined : { onClick: toNext, disabled: !way || held }, skipped)}
        {/* ONE PANEL (MESITA-4077): credits, App and Cash, then what is left
            to pay. Each way says what it earns; nothing else repeats it. */}
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
                  <BackBox back={creditBack} />
                </span>
                <CreditsPill>{m(spendable)}</CreditsPill>
                <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", creditOn ? "bg-foreground" : "bg-border")} aria-hidden>
                  <span className={cn("bg-card absolute top-0.5 h-5 w-5 rounded-full shadow transition-all", creditOn ? "left-[18px]" : "left-0.5")} />
                </span>
              </button>
            ) : null}
            {creditsOnly ? null : (
              <div className="divide-border flex flex-col divide-y" role="radiogroup" aria-label="How you pay">
                <MethodTile
                  on={way === "card"}
                  off={appWhy}
                  icon={<Smartphone />}
                  tone="bg-pink-gradient text-white"
                  id="app"
                  title="Pay in the app"
                  line="With your card, here in Mesita"
                  back={backLine("card")}
                  onPick={() => setMethod("card")}
                />
                <MethodTile
                  on={way === "cash"}
                  off={cashWhy}
                  icon={<Banknote />}
                  tone={CASH_GREEN}
                  id="cash"
                  title="Pay outside the app"
                  line="Cash or the place's card terminal"
                  back={backLine("cash")}
                  onPick={() => setMethod("cash")}
                />
              </div>
            )}
            {creditOn ? <MoneyRow label="Credits" value={`−${m(creditCents)}`} /> : null}
            <MoneyRow label={leftCents === 0 ? "Tip to pay" : "Left to pay"} value={m(dueCents)} strong />
            </div>
            {/* YOU GET BACK (MESITA-4100): the chosen way's cashback, the
                panel's one loud number, green above $0 and grey at $0. */}
            {way || creditsOnly ? (
              <div
                className={cn(
                  "mx-4 mb-4 flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ring-inset",
                  chosenBack > 0 ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : "bg-muted text-muted-foreground ring-border",
                )}
                role="status"
                data-guest-cashback
              >
                <Coins className="h-6 w-6 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">You get back</span>
                  <span className={cn("block truncate text-sm", chosenBack > 0 ? "text-emerald-800" : "text-muted-foreground")}>
                    As credits at {place.name}
                  </span>
                </span>
                <span className="shrink-0 text-2xl font-semibold tabular-nums">{chosenBack > 0 ? `+${m(chosenBack)}` : "0% back"}</span>
              </div>
            ) : null}
          </PaySection>
        </StepBody>
        {status}
        <StepFooter
          onCancel={askCancel}
          cancelDisabled={cancelLocked}
          primary={
            creditsOnly
              ? { label: "Pay with credits", busy, disabled: held, onClick: () => void openBill(null) }
              : { label: "Next", busy, disabled: !way || held, onClick: toNext }
          }
        />
      </>,
      "method",
    );
  }

  // 5 CARD (MESITA-4117, Pato: "Card (this one is if you selected to pay
  // using mesita cards, like which of all your cards"): the saved cards as
  // rows, the draft's (or the first) preselected, a just-refused card listed
  // but never preselected; Add a card is its own page and comes back here
  // with the new card chosen. Only on the card way with something to pay
  // (guardStage sends anything else back to Method).
  if (shown === "card") {
    const toPay = () => {
      if (!chosenCard) return;
      // The draft always holds the card that Pay will charge.
      setCardId(chosenCard);
      setStage("pay");
    };
    const pickable = (cards ?? []).length < 3;
    const noCard = !cardsUnknown && !chosenCard;
    return frame(
      <>
        {top(STEP.card, backArrow, { onClick: toPay, disabled: cardsUnknown || !chosenCard || held })}
        <StepBody>
          <PaySection title="Which card?" className="text-base">
            {/* The money, so the card is picked with the amount in view. */}
            <p className="text-muted-foreground px-4 pb-3 text-sm" data-guest-card-amount>
              {m(dueCents)} to your card{creditOn && creditCents > 0 ? ` · ${m(creditCents)} from credits` : ""}
            </p>
            {cardsUnknown ? (
              cardsLoad.state === "failed" ? (
                <button type="button" className="mx-4 mb-4 text-left text-sm font-semibold underline" onClick={retryCards}>
                  Couldn&apos;t load your cards. Retry
                </button>
              ) : (
                <div className="flex flex-col gap-2 px-4 pb-4" aria-busy>
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              )
            ) : (cards ?? []).length === 0 ? (
              <p className="px-4 pb-4 text-base font-semibold" data-guest-no-cards>
                No cards yet
              </p>
            ) : (
              <div className="divide-border border-border divide-y border-t" role="radiogroup" aria-label="Card">
                {(cards ?? []).map((c: SavedCard) => {
                  const on = c.id === chosenCard;
                  const refused = c.id === refusedCardId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setCardId(c.id);
                        // Tapping the refused card tries it again.
                        if (refused) setRefusedCardId(null);
                      }}
                      className="hover:bg-muted/60 flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition"
                      data-guest-card-row
                    >
                      <CardBrandChip brand={c.brand} last4={c.last4} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold">
                          {brandLabel(c.brand)} •••• {c.last4}
                        </span>
                        {refused ? <span className="text-muted-foreground block text-sm">Declined just now</span> : null}
                      </span>
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                          on ? "bg-foreground text-background" : "border-border border-2",
                        )}
                        aria-hidden
                      >
                        {on ? <Check className="h-4 w-4" /> : null}
                      </span>
                    </button>
                  );
                })}
                {pickable && !noCard ? (
                  <button type="button" className="hover:bg-muted/60 flex min-h-14 w-full items-center gap-3 px-4 text-left text-base font-semibold transition" onClick={addCard}>
                    <Plus className="h-5 w-5" aria-hidden />
                    Add a card
                  </button>
                ) : null}
              </div>
            )}
          </PaySection>
        </StepBody>
        {status}
        <StepFooter
          onCancel={askCancel}
          cancelDisabled={cancelLocked}
          primary={
            noCard
              ? // No card to charge (none saved, or the only one was just
                // refused): adding one is the step's action.
                { label: "Add a card", busy, disabled: held, onClick: addCard }
              : { label: "Next", busy, disabled: cardsUnknown || !chosenCard || held, onClick: toPay }
          }
        />
      </>,
      "card",
    );
  }

  // 6A APP PAY: the card picked on Card, "Pay in one click", held now. Pay
  // moves money: › is not offered. Only stage "pay" reaches here.
  const paySkipped = skippedSegments({ way, creditsOnly });
  const backLine = (
    <p
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-sm font-semibold ring-1 ring-inset",
        cashbackFor(way ?? "card") > 0 ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-muted text-muted-foreground ring-border",
      )}
      data-guest-pay-back
    >
      <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {backText(cashbackFor(way ?? "card"))}
    </p>
  );
  if (way === "card") {
    const guestFace = card ? cardFace(card.brand, brandLabel(card.brand)) : null;
    return frame(
      <>
        {top(STEP.pay, backArrow, undefined, paySkipped)}
        {/* ONE CENTRED CHARGE (MESITA-4100, Pato: "the pay step must be a
            simple pay button centered with the selected card, like charge X
            to this card"): the card is picked on Method, so here it is the
            card, the amount and one line on when it is charged. No CVC: a
            saved card is charged by Stripe without it; a bank that wants its
            own check asks in its window when Pay is tapped (runBankCheck). */}
        <StepBody className="flex-1">
          <PaySection className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center" data-guest-card-pay>
            {cardsUnknown ? (
              cardsLoad.state === "failed" ? (
                <button type="button" className="text-base font-semibold underline" onClick={retryCards}>
                  Couldn&apos;t load your cards. Retry
                </button>
              ) : (
                <Skeleton className="h-36 w-56 rounded-2xl" />
              )
            ) : card ? (
              <>
                <span className="flex flex-col items-center gap-1">
                  <span className="text-muted-foreground text-lg font-semibold">Charge</span>
                  <span className="text-4xl font-semibold tabular-nums">{m(dueCents)}</span>
                  <span className="text-muted-foreground text-lg">to this card</span>
                </span>
                <span
                  className={cn("flex h-36 w-56 flex-col justify-between rounded-2xl p-5 text-left shadow-md", guestFace?.className)}
                  style={guestFace?.style}
                  role="img"
                  aria-label={`${brandLabel(card.brand)} ending ${card.last4}`}
                  data-guest-card
                >
                  {guestFace?.mark}
                  <span className="text-lg font-semibold tracking-widest tabular-nums">•••• {card.last4}</span>
                </span>
                {backLine}
                <p className="text-muted-foreground flex max-w-xs items-center justify-center gap-2 text-sm">
                  <Lock className="h-4 w-4 shrink-0" aria-hidden />
                  Held now, charged when the waiter signs.
                </p>
              </>
            ) : null}
          </PaySection>
        </StepBody>
        {status}
        <StepFooter
          onCancel={askCancel}
          cancelDisabled={cancelLocked}
          // "Pay in one click" (MESITA-4106, Pato: "the button must say pay
          // in one click"); the amount is the body's headline. With no card
          // resolvable guardStage shows Card instead.
          primary={{ label: "Pay in one click", busy, disabled: held || !card, onClick: () => void openBill("card") }}
        />
      </>,
      "app",
    );
  }

  // 4B CASH PAY: give the cash, then the QR. The bubble, the amount and the
  // words sit together in the middle.
  return frame(
    <>
      {top(STEP.pay, backArrow, undefined, paySkipped)}
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
          {backLine}
          <span className="text-muted-foreground max-w-xs text-lg leading-snug">Then show them your QR so they confirm it.</span>
        </PaySection>
      </StepBody>
      {status}
      <StepFooter onCancel={askCancel} cancelDisabled={cancelLocked} primary={{ label: "I gave the cash", busy, disabled: held, onClick: () => void openBill("cash") }} />
    </>,
    "cash",
  );
}

/** A row's cashback as a box (MESITA-4100, Pato: "THE CASHBACK AMOUNT IS
 *  SUPER IMPORTANT ... IN A BOX WITH COLOR"): green with the amount when the
 *  part earns, grey "0% back" when it does not (never "no back"). */
function BackBox({ back }: { back: { text: string; good: boolean } }) {
  return (
    <span
      className={cn(
        "mt-1.5 inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-0.5 text-sm font-semibold ring-1 ring-inset",
        back.good ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-muted text-muted-foreground ring-border",
      )}
      data-guest-back
    >
      <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{back.text}</span>
    </span>
  );
}

/** A row for App or Cash in the How you pay panel (MESITA-4072; a bordered
 *  tile with a thick border when chosen until then): the ring on the right
 *  fills when chosen; grey with one line why when the place can't take it. */
/** Method's rows share one leading slot (MESITA-4085), as wide as the
 *  Credits Card image, each mark at its left edge: the marks start on one
 *  edge and the words on another. */
const LEAD_SLOT = "flex w-[3.2rem] shrink-0 items-center";

function MethodTile({
  id,
  on,
  off,
  icon,
  tone,
  title,
  line,
  back,
  onPick,
}: {
  /** The test hook: "app" or "cash". */
  id: string;
  on: boolean;
  off: string | null;
  icon: React.ReactNode;
  /** The way's own colour (MESITA-3877): App the brand pink, Cash the
   *  Wallet's Cash green. Grey when the place can't take it. */
  tone: string;
  title: string;
  line: string;
  /** What the way earns, a box (MESITA-4100): "5% back · +MX$5.75" in green,
   *  or a grey "0% back" (MESITA-4058: always said). */
  back: { text: string; good: boolean };
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
      <span className={LEAD_SLOT}>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&>svg]:h-5 [&>svg]:w-5", off ? "bg-muted" : tone)} aria-hidden>
          {icon}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="text-muted-foreground block truncate text-sm">{off ?? line}</span>
        {!off ? <BackBox back={back} /> : null}
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
