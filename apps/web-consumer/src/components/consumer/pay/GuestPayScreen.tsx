"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, Check, CreditCard, Lock, ReceiptText, XCircle } from "lucide-react";
import { readAmount } from "@mesita/place-profile/lib/money";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiListCards, brandLabel } from "@/lib/api/cards";
import { useAddCardModal } from "@/lib/added-card";
import { apiListVisits, apiPayGuest, type PayWith, runBankCheck, TAB_REFUSAL } from "@/lib/api/tab";
import { pickOpenGuestPayment } from "@/lib/pay-open";
import { apiExpressSetup, money, type PayPlace } from "@/lib/api/wallet";
import { ExpressBillPay } from "./ExpressBillPay";
import type { ExpressWallet } from "./ExpressPayButton";
import { acceptCardsAnswer, type CardsLoad, cardsFailure, loadedCards, pickCard } from "@/lib/pay-cards";
import { guardStage, initialStage, PAY_CARD_REFUSALS, payBackStage, STEP } from "@/lib/guest-pay-stages";
import {
  clearGuestDraft,
  outcomeUnknownAfter,
  pendingTicket,
  PENDING_NAME_KEY,
  readDraft,
  readLastCard,
  readLastTip,
  requestIdAfterEdit,
  type Tip,
  TIP_CHIPS,
  type Stage,
  writeDraft,
  writeLastCard,
  writeLastTip,
} from "@/lib/guest-pay-draft";
import { trackEvent } from "@/lib/analytics/track";
import { type PadKey, pressKey, readTip } from "@/lib/pay-keypad";
import { payPlacePath } from "@/lib/consumer-route-contract";
import { clearSessionHref } from "@/lib/stale-session";
import { cn } from "@/lib/utils";
import { cardFace } from "@/components/shared/card-brand-marks";
import { AmountDisplay, AmountKeypad } from "./AmountKeypad";
import { CashChip, CreditsCardChip, CreditsPill, SavedCardChip } from "@/components/consumer/wallet/WalletLists";
import { BAD, MoneyRow, NOT_PAID_REASON, PayTop, PaySection, PlaceHero, StepBody, StepFooter } from "./pay-flow";
import { NETWORK_FAILURE, QUIET_BUTTON_CLASS, rememberGuestTab, CancelBillButtons } from "./pay-common";

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
/** Refusals that mean this card, not the bill: Method marks it "Declined just now". */
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
  onLeavePay,
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
  // APPLE PAY / GOOGLE PAY (MESITA-4386): the card part by the phone's
  // wallet, held at Face ID and charged when the waiter signs. `express` is
  // the guest's pick; `expressOn` says the place can take it (setup); the
  // Pay step's button says whether this phone can.
  const [express, setExpress] = useState(draft?.express === true);
  const [expressOn, setExpressOn] = useState(false);
  // MESITA-4397: Apple Pay and Google Pay are two rows; `wallet` is the one
  // picked, `wallets` what the place's setup offers, `applePhone` whether
  // this browser is Apple's (it has Apple Pay and no Google Pay button).
  const [wallet, setWallet] = useState<ExpressWallet | null>(draft?.wallet ?? null);
  const [wallets, setWallets] = useState<ExpressWallet[]>([]);
  const [applePhone, setApplePhone] = useState(false);
  const [expressState, setExpressState] = useState<"loading" | "ready" | "none">("loading");
  const [cardId, setCardId] = useState<string | null>(draft?.cardId ?? readLastCard());
  // The card the bank just refused: Method says "Declined just now" (MESITA-4226).
  const [refusedCardId, setRefusedCardId] = useState<string | null>(draft?.refusedCardId ?? null);
  const [cardsLoad, setCardsLoad] = useState<CardsLoad>({ state: "loading" });
  const [cardsAttempt, setCardsAttempt] = useState(0);
  const latestCardsAttempt = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notPaid, setNotPaid] = useState<string | null>(null);
  // A card refusal on Pay (MESITA-4121): the guest stays on Pay with the
  // refusal line; the card shown is the one refused, and the main button
  // leads to another card (or another way when the place refused cards).
  const [payRefusal, setPayRefusal] = useState<{ code: string; cardId: string | null } | null>(null);
  const requestId = useRef<string | null>(null);
  // A pay call timed out or lost the network: the bill may be open on the
  // server. Until that same request id answers, Cancel bill and ‹ are locked
  // and nothing mints a new id (MESITA-4061).
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  // Cancel bill asks first (MESITA-4068, Pato: "ask confirmation to cancel bill").
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cashDue, setCashDue] = useState<number | null>(null);

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
  // Mesita App is preselected wherever the place takes cards and the guest
  // has not picked cash (MESITA-4123); a way the place refuses falls to the
  // other one.
  const way: PayWith | null = method === "cash" && cashOn ? "cash" : appOn ? "card" : cashOn ? "cash" : null;
  const chosenCard = pickCard(cards, cardId);
  const creditsOnly = dueCents === 0;
  // The step shown (MESITA-4117): a stored or live stage that stopped making
  // sense goes back to Method, or to Card when no card can be charged. Pure,
  // so nothing sets state while rendering.
  const shown = guardStage({ stage, method, way, dueCents });

  // Every change is saved, so the X and "Add a card" come back to it.
  useEffect(() => {
    if (sentTabId) return;
    requestId.current = requestIdAfterEdit(requestId.current, outcomeUnknown);
    writeDraft(placeId, { stage: shown, typing, amount, tip, other, useCredit, method, express, wallet, cardId, refusedCardId });
  }, [sentTabId, placeId, shown, typing, amount, tip, other, useCredit, method, express, wallet, cardId, refusedCardId, outcomeUnknown]);

  // Whether the place can take Apple Pay / Google Pay for what's left
  // (MESITA-4386): asked once the amount settles, on Method and Pay.
  useEffect(() => {
    if (!cardOk || dueCents <= 0 || (shown !== "method" && shown !== "pay")) return;
    let gone = false;
    const t = window.setTimeout(() => {
      void apiExpressSetup(getSupabase(), { place_id: placeId, bill: { amount_cents: dueCents } })
        .then((r) => {
          if (gone) return;
          setExpressOn(r.available);
          setWallets(r.available ? r.wallets : []);
          setApplePhone("ApplePaySession" in window);
        })
        .catch(() => {
          if (!gone) setExpressOn(false);
        });
    }, 300);
    return () => {
      gone = true;
      window.clearTimeout(t);
    };
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardOk, dueCents, shown, placeId]);

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
    if (shown === "pay" || shown === "method") setStage(payBackStage(shown));
    else if (!typing) setTyping(true);
    else return false;
    setError(null);
    setPayRefusal(null);
    return true;
  }
  useEffect(() => {
    registerBack?.(backOneStep);
  });
  useEffect(() => () => registerBack?.(null), [registerBack]);

  // Add a card in the app (MESITA-4065: no Stripe page): the card sheet; the
  // saved card becomes the bill's card.
  // A modal since MESITA-4398 (a page in MESITA-4101): once saved, the saved
  // card becomes the bill's card. The draft survives the trip.
  const openAddCard = useAddCardModal((id) => {
    writeLastCard(id);
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
    setPayRefusal(null);
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
      if (w === "card") writeLastCard(chosenCard);
      // Start again comes back to the bill with everything typed; the draft
      // keeps the card actually charged, not only one the guest tapped.
      writeDraft(placeId, { stage: "bill", typing: false, amount, tip, other, useCredit, method, cardId: w === "card" ? chosenCard : cardId, refusedCardId, sentTabId: r.tab_id ?? undefined });
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
      // Refused before the bill opened (MESITA-4121): nothing is held, so the
      // guest stays on Pay; the next tap sends a fresh request id.
      if (w === "card" && code && PAY_CARD_REFUSALS.has(code)) {
        setPayRefusal({ code, cardId: chosenCard });
        setError(TAB_REFUSAL[code] ?? NOT_PAID_REASON[code] ?? NETWORK_FAILURE);
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
          <CancelBillButtons disabled={cancelLocked} onCancel={cancelBill} onKeep={() => setConfirmCancel(false)} />
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
    onLeavePay();
  };
  // The top of every step (MESITA-4061, Pato: "X Pay / Profile Name of place
  // / steps with arrows to nav across them < >"): the place, then the step
  // nav. ‹ is the same step back as the header's back arrow; › only where
  // the footer's button is a plain Next.
  const backArrow = held || outcomeUnknown ? undefined : () => void backOneStep();
  const top = (at: number, onBack: (() => void) | undefined, next?: { onClick: () => void; disabled: boolean }) => (
    <PayTop place={place} onChoose={leave} step={{ at, onBack, next }} />
  );

  // NOT PAID (before the bill opened: the card was refused).
  if (notPaid) {
    return frame(
      <>
        <PayTop place={place} />
        <StepBody>
          <PaySection className="flex flex-col items-center p-4 text-center">
            <XCircle className={cn("h-10 w-10", BAD)} aria-hidden />
            <h2 className="mt-2 text-xl font-semibold">Not paid</h2>
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

  if (cashDue !== null) {
    return frame(
      <>
        {top(STEP.pay, backArrow)}
        <StepBody>
          <PaySection className="p-6 text-center">
            <p className="text-muted-foreground text-lg font-semibold">Hand over</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">{m(cashDue)}</p>
            <p className="text-muted-foreground mt-3 text-sm">The place marks this received. Nothing else is charged.</p>
          </PaySection>
        </StepBody>
      </>,
      "cash-due",
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
                onClick={() => setTip("other")}
              >
                {tip === "other" ? m(tipCents) : "Other"}
              </button>
            </div>
            {tip === "other" ? (
              <div className="px-4 pb-4" data-guest-tip-other>
                <AmountDisplay text={other} currency={place.currency} label="Tip" className="shrink-0" />
                <AmountKeypad text={other} onKey={(k) => setOther((t) => pressKey(t, k))} />
              </div>
            ) : null}
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
      </>,
      "review",
    );
  }

  // The guest's one saved card (MESITA-4168), named on Method, charged on Pay.
  const card = cards?.find((c) => c.id === chosenCard) ?? null;
  const cardsUnknown = cards === null;
  const retryCards = () => {
    setCardsLoad({ state: "loading" });
    setCardsAttempt((n) => n + 1);
  };

  // 3 METHOD: App or Cash for everything that's left.
  if (shown === "method") {
    // Credits cover the bill and the tip: nothing is left for a way, so the
    // button opens the bill (credits are spent). It is money, so › is not
    // offered.
    // Next: Pay, for either way (MESITA-4226: no Card step).
    const toNext = () => {
      if (way) {
        setMethod(way);
        setStage("pay");
      }
    };
    return frame(
      <>
        {top(STEP.method, backArrow, creditsOnly ? undefined : { onClick: toNext, disabled: !way || held })}
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
                </span>
                <CreditsPill>{m(spendable)}</CreditsPill>
                <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", creditOn ? "bg-foreground" : "bg-border")} aria-hidden>
                  <span className={cn("bg-card absolute top-0.5 h-5 w-5 rounded-full shadow transition-all", creditOn ? "left-[18px]" : "left-0.5")} />
                </span>
              </button>
            ) : null}
            {creditsOnly ? null : (
              <div className="divide-border flex flex-col divide-y" role="radiogroup" aria-label="How you pay">
                {/* CARD (MESITA-4244, Pato: "maybe just mentioning the card
                    i think its clearer. with the visa thing. just say Card";
                    was "Mesita App" on the brand pink, MESITA-4123): the
                    guest's one saved card, its brand chip as on the Wallet;
                    the choice is the ring. */}
                <MethodTile
                  on={way === "card" && !(express && expressOn)}
                  off={appWhy}
                  lead={card ? <SavedCardChip brand={card.brand} last4={card.last4} /> : <NoCardChip />}
                  id="app"
                  title="Card"
                  line={card ? `${brandLabel(card.brand)} •••• ${card.last4}${card.id === refusedCardId ? " · Declined just now" : ""}` : "Add one on the next step"}
                  onPick={() => {
                    setMethod("card");
                    setExpress(false);
                    setWallet(null);
                  }}
                />
                {/* APPLE PAY and GOOGLE PAY (MESITA-4386; two rows since
                    MESITA-4397, Pato: "show apple pay and google pay
                    separated"): Face ID on Pay holds it; the waiter's code
                    charges it. The one this browser can't use stays, greyed. */}
                {expressOn && !appWhy
                  ? EXPRESS_ROWS.filter((r) => wallets.includes(r.wallet)).map((r) => (
                      <MethodTile
                        key={r.wallet}
                        on={way === "card" && express && wallet === r.wallet}
                        off={(r.wallet === "apple_pay") === applePhone ? null : "Not on this phone"}
                        lead={r.chip}
                        id={r.wallet}
                        title={r.title}
                        line="Charged when you confirm"
                        onPick={() => {
                          setMethod("card");
                          setExpress(true);
                          setWallet(r.wallet);
                        }}
                      />
                    ))
                  : null}
                {/* Cash in its dollar-bill green (MESITA-4244, Pato: "for
                    cash use green"), the Wallet's Cash chip. */}
                <MethodTile
                  on={way === "cash"}
                  off={cashWhy}
                  lead={<CashChip />}
                  id="cash"
                  title="Pay outside the app"
                  line="Cash or the place's card terminal"
                  onPick={() => {
                    setMethod("cash");
                    setExpress(false);
                    setWallet(null);
                  }}
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
          onCancel={askCancel}
          cancelDisabled={cancelLocked}
          primary={
            creditsOnly
              ? { label: "Pay with credits", busy, disabled: held, onClick: () => void openBill(null) }
              : way === "cash"
                ? { label: `Pay ${m(dueCents)} in cash`, busy, disabled: held, onClick: () => void openBill("cash") }
                : way === "card" && !(express && expressOn)
                  ? { label: `Pay ${m(dueCents)} with card`, busy, disabled: !chosenCard || held, onClick: () => void openBill("card") }
                  : { label: "Next", busy, disabled: !way || held, onClick: toNext }
          }
        />
      </>,
      "method",
    );
  }

  // 4A' APPLE PAY / GOOGLE PAY (MESITA-4386): the amount, the phone's own
  // wallet button and when it is charged. Face ID holds the card part and
  // opens the bill; the waiter's code charges it. A phone without a wallet
  // says so, and the way out is Method.
  if (way === "card" && express && expressOn && wallet) {
    const walletName = wallet === "apple_pay" ? "Apple Pay" : "Google Pay";
    const chooseAnother = () => {
      setError(null);
      setPayRefusal(null);
      setExpress(false);
      setWallet(null);
      setStage("method");
    };
    return frame(
      <>
        {top(STEP.pay, backArrow)}
        <StepBody className="flex-1">
          <PaySection className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center" data-guest-express-pay={expressState}>
            <span className="flex flex-col items-center gap-1">
              <span className="text-muted-foreground text-lg font-semibold">Pay</span>
              <span className="text-4xl font-semibold tabular-nums">{m(dueCents)}</span>
            </span>
            <div className="relative min-h-12 w-full max-w-xs">
              {expressState === "loading" ? <Skeleton className="absolute inset-0 h-12 rounded-xl" /> : null}
              {expressState === "none" ? (
                <p className="text-base font-semibold" role="status">
                  This phone can&apos;t pay with {walletName} here. Choose another way.
                </p>
              ) : null}
              <div className={cn(expressState !== "ready" && "pointer-events-none opacity-0")}>
                <ExpressBillPay
                  wallet={wallet}
                  getSupabase={getSupabase}
                  placeId={placeId}
                  billCents={billCents}
                  dueCents={dueCents}
                  split={{ credit_cents: creditCents, card_bill_cents: leftCents, card_tip_cents: tipCents, cash_bill_cents: 0, cash_tip_cents: 0 }}
                  requestId={() => (requestId.current ??= crypto.randomUUID())}
                  disabled={held}
                  onState={setExpressState}
                  onLock={setBusy}
                  onOpened={(tabId, qrUrl) => {
                    rememberGuestTab(tabId, qrUrl);
                    writeLastTip(placeId, tip);
                    writeDraft(placeId, { stage: "bill", typing: false, amount, tip, other, useCredit, method, express, wallet, cardId, refusedCardId, sentTabId: tabId });
                    setOutcomeUnknown(false);
                  }}
                  onBill={(tabId) => onPaid(tabId)}
                  onError={(text) => {
                    requestId.current = null;
                    setError(text);
                  }}
                />
              </div>
            </div>
            {busy ? (
              <p className="text-base font-semibold" role="status" data-guest-express-paying>
                Paying…
              </p>
            ) : null}
            <p className="text-muted-foreground flex max-w-xs items-center justify-center gap-2 text-sm">
              <Lock className="h-4 w-4 shrink-0" aria-hidden />
              Charged when you confirm.
            </p>
          </PaySection>
        </StepBody>
        {status}
        <StepFooter
          onCancel={askCancel}
          cancelDisabled={cancelLocked}
          primary={{ label: "Choose another way", busy: false, disabled: held, onClick: chooseAnother }}
        />
      </>,
      "express",
    );
  }

  // 4A APP PAY: the guest's one saved card (MESITA-4168; the Card step that
  // picked among several is gone, MESITA-4226), "Pay $X" (MESITA-4316),
  // held now. No card saved: "Add a card", which comes back here with it. Pay
  // moves money: › is not offered. Only stage "pay" reaches here.
  if (way === "card") {
    const shownCard = card;
    const guestFace = shownCard ? cardFace(shownCard.brand, brandLabel(shownCard.brand)) : null;
    // After a refusal the way out is Method (the guest has one card).
    const chooseAnother = () => {
      setError(null);
      setPayRefusal(null);
      setStage("method");
    };
    const payOutside = () => {
      setError(null);
      setPayRefusal(null);
      setMethod("cash");
      setStage("method");
    };
    return frame(
      <>
        {top(STEP.pay, backArrow)}
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
                  Couldn&apos;t load your card. Retry
                </button>
              ) : (
                <Skeleton className="h-36 w-56 rounded-2xl" />
              )
            ) : !shownCard ? (
              <span className="flex flex-col items-center gap-1" data-guest-no-cards>
                <span className="text-muted-foreground text-lg font-semibold">Add a card to pay</span>
                <span className="text-4xl font-semibold tabular-nums">{m(dueCents)}</span>
              </span>
            ) : shownCard ? (
              <>
                <span className="flex flex-col items-center gap-1">
                  <span className="text-muted-foreground text-lg font-semibold">Pay</span>
                  <span className="text-4xl font-semibold tabular-nums">{m(dueCents)}</span>
                  <span className="text-muted-foreground text-lg">with this card</span>
                </span>
                <span
                  className={cn("flex h-36 w-56 flex-col justify-between rounded-2xl p-5 text-left shadow-md", guestFace?.className)}
                  style={guestFace?.style}
                  role="img"
                  aria-label={`${brandLabel(shownCard.brand)} ending ${shownCard.last4}`}
                  data-guest-card
                >
                  {guestFace?.mark}
                  <span className="text-lg font-semibold tracking-widest tabular-nums">•••• {shownCard.last4}</span>
                </span>
                <p className="text-muted-foreground flex max-w-xs items-center justify-center gap-2 text-sm">
                  <Lock className="h-4 w-4 shrink-0" aria-hidden />
                  Charged when you confirm.
                </p>
              </>
            ) : null}
          </PaySection>
        </StepBody>
        {status}
        {/* Pay outside the app: a quiet second way out of a refusal, only
            where the place takes cash (MESITA-4121). */}
        {payRefusal && cashOn ? (
          <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-2 shrink-0")} onClick={payOutside} data-guest-pay-outside>
            Pay outside the app
          </button>
        ) : null}
        <StepFooter
          onCancel={askCancel}
          cancelDisabled={cancelLocked}
          // "Pay $X" (MESITA-4316, was "Pay in one click", MESITA-4106): the
          // card is held now and charged when the waiter signs. No card
          // saved: Add a card. After a refusal the main button leads back
          // to Method (MESITA-4121, MESITA-4226).
          primary={
            payRefusal
              ? { label: "Choose another way", busy: false, disabled: held, onClick: chooseAnother }
              : !cardsUnknown && !card
              ? { label: "Add a card", busy, disabled: held, onClick: addCard }
              : { label: `Pay ${m(dueCents)}`, busy, disabled: held || !card, onClick: () => void openBill("card") }
          }
        />
      </>,
      "app",
    );
  }

  // 4B CASH PAY: give the cash, then the QR. The bubble, the amount and the
  // words sit together in the middle.
  return frame(
    <>
      {top(STEP.pay, backArrow)}
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
      <StepFooter onCancel={askCancel} cancelDisabled={cancelLocked} primary={{ label: "I gave the cash", busy, disabled: held, onClick: () => void openBill("cash") }} />
    </>,
    "cash",
  );
}

/** A row for App or Cash in the How you pay panel (MESITA-4072; a bordered
 *  tile with a thick border when chosen until then): the ring on the right
 *  fills when chosen; grey with one line why when the place can't take it. */
/** Apple Pay's and Google Pay's marks (MESITA-4397): a black chip and a
 *  white one, the Wallet's chip shape; the brands' own buttons are on Pay. */
function ApplePayChip() {
  return (
    <span className="flex h-8 w-[3.2rem] items-center justify-center rounded-md bg-neutral-950 text-xs font-semibold tracking-tight text-white" aria-hidden>
      <svg viewBox="0 0 814 1000" className="mr-0.5 h-3.5 w-3.5 fill-current" aria-hidden>
        <path d="M788 341c-6 4-108 62-108 190 0 149 131 201 135 203-1 3-21 72-69 142-43 62-88 123-156 123s-86-40-164-40c-77 0-104 41-166 41s-106-57-156-127C47 790 0 663 0 541c0-194 126-297 250-297 66 0 121 43 162 43 40 0 102-46 177-46 29 0 131 3 199 100zM554 160c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 1 16 2 18 3 1 9 2 14 2 45 0 102-30 134-72z" />
      </svg>
      Pay
    </span>
  );
}

function GooglePayChip() {
  return (
    <span className="border-border flex h-8 w-[3.2rem] items-center justify-center gap-0.5 rounded-md border bg-white text-xs font-semibold tracking-tight text-neutral-700" aria-hidden>
      <svg viewBox="0 0 48 48" className="h-3.5 w-3.5" aria-hidden>
        <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.2z" />
        <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C8 41.1 15.4 46 24 46z" />
        <path fill="#FBBC05" d="M11.7 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.4C2.9 17.1 2 20.5 2 24s.9 6.9 2.4 9.9l7.3-5.7z" />
        <path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8 6.9 4.4 14.1l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1z" />
      </svg>
      Pay
    </span>
  );
}

/** Method's two phone-wallet rows, in this order (MESITA-4397). */
const EXPRESS_ROWS: { wallet: ExpressWallet; title: string; chip: React.ReactNode }[] = [
  { wallet: "apple_pay", title: "Apple Pay", chip: <ApplePayChip /> },
  { wallet: "google_pay", title: "Google Pay", chip: <GooglePayChip /> },
];

/** Method's rows share one leading slot (MESITA-4085), as wide as the
 *  Credits Card image, each mark at its left edge: the marks start on one
 *  edge and the words on another. */
const LEAD_SLOT = "flex w-[3.2rem] shrink-0 items-center";

/** No card saved yet: a black card chip, the Wallet's chip shape. */
function NoCardChip() {
  return (
    <span className="flex h-8 w-[3.2rem] shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white" aria-hidden>
      <CreditCard className="h-4 w-4" />
    </span>
  );
}

function MethodTile({
  id,
  on,
  off,
  lead,
  title,
  line,
  onPick,
}: {
  /** The test hook: "app" or "cash". */
  id: string;
  on: boolean;
  off: string | null;
  /** The way's chip, the Wallet's (MESITA-4244): the saved card's brand,
   *  Cash's green. Greyed when the place can't take it. */
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
