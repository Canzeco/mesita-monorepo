"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, CreditCard, Wallet } from "lucide-react";
import { readAmount } from "@mesita/place-profile/lib/money";
import { payStepName } from "@mesita/place-profile/lib/pay-steps";
import { AddChip, CashChip, PlainChip, SavedCardChip } from "@/components/consumer/wallet/WalletLists";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { LocalDialog, LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiAddCard, apiListCards, brandLabel, CARD_REFUSAL, CARD_RETURN_PARAM, MAX_SAVED_CARDS } from "@/lib/api/cards";
import { apiPayGuest, type PayWith, runBankCheck, TAB_REFUSAL } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";
import { acceptCardsAnswer, type CardsLoad, cardsFailure, fixedMethod, loadedCards, methodsWaitOnCards, pickCard } from "@/lib/pay-cards";
import { payDraftExpired, type PayDraft, PLACE_PAY_STEPS, type PlacePayStep, readPayDraft, stampPayDraft, TIP_PERCENTS, type TipPercent, type TipPick } from "@/lib/pay-draft";
import { clearSessionHref } from "@/lib/stale-session";
import { type PadKey, payButton, payProblem, paySplit, pressKey, readTip, tipWays } from "@/lib/pay-keypad";
import { cn } from "@/lib/utils";
import { AmountDisplay, AmountKeypad } from "./AmountKeypad";
import { PlacePhoto, QUIET_BUTTON_CLASS, rememberGuestTab } from "./pay-common";
import { PaySteps } from "./PaySteps";

// THE GUEST PAYS ALONE (MESITA-3709), one step per screen at /pay/<placeId>
// (MESITA-3715). These are steps 2 to 5 of the six pay steps (MESITA-3759,
// lib/pay-steps in place-profile): Bill (before tip) → Tip → Methods → Pay
// (Bill, Tip, Total, the cashback, and one button that says what the tap
// does). The header's back arrow steps back. After Pay the guest lands on
// their payment's page (/pay/tab/<id>) and shows its QR to the waiter, who
// signs it. Every rule and peso is the server's; this screen proposes.
//
// ONE SCREEN A STEP, NOTHING SCROLLS (MESITA-3739, Pato: "make it not
// scrollable, try to fit all in one page"): white, no tab bar, and each step
// is a fixed column. The strip's label ("2 · Bill") is the page's only
// heading: there is no question headline. Amounts are typed on a keypad
// drawn in the page (the phone keyboard covered Next); the amount sits right
// above the keypad and spare height goes above the amount. Credit is the
// first row of Methods, on by default; above MX$3,000 Pay asks first in a
// dialog.
//
//   ┌ photo · name ················ 2 · Bill ┐   PaySteps, row one (36px)
//   │ ━━━━ ▭▭▭▭ ──── ──── ──── ────           │   PaySteps, six segments
//   │ body (flex-1: keypad docked at the      │
//   │       bottom / rows card at the top)    │
//   │ [ status line ]                         │
//   └ [ Next / Add a card / Pay ]             ┘   pinned
//
// THE DRAFT (lib/pay-draft.ts) lives 30 minutes after its last change; it
// is checked on opening and again when the tab is looked at after a while.

type Pct = TipPercent;
/** null: not answered yet. There is no "No tip" button: no tip is Other
 *  with 0 typed (Pato, MESITA-3748). */
type Tip = TipPick;
/** The amount past which Pay asks "Pay MX$X at <place>?" first. */
const CONFIRM_ABOVE_CENTS = 300_000;
const DRAFT_KEY = (placeId: string) => `mesita.pay.guest-draft.${placeId}`;
/** Saved cards shown in the rows card: all three a guest may save
 *  (MESITA-3749). A guest who saved more before the limit opens the rest
 *  in a sheet. */
const CARDS_SHOWN = MAX_SAVED_CARDS;

const STEPS = PLACE_PAY_STEPS;
type Step = PlacePayStep;

const CARD_PAGE_FAILURE = "Couldn't open the card page. Tap Add a card again.";

function readDraft(placeId: string): PayDraft | null {
  if (typeof window === "undefined") return null;
  try {
    return readPayDraft(window.sessionStorage.getItem(DRAFT_KEY(placeId)), Date.now());
  } catch {
    return null;
  }
}

/** Saves the draft with the time it was written; null removes it. */
function writeDraft(placeId: string, d: Omit<PayDraft, "savedAt"> | null, now = 0) {
  try {
    if (d) window.sessionStorage.setItem(DRAFT_KEY(placeId), stampPayDraft(d, now));
    else window.sessionStorage.removeItem(DRAFT_KEY(placeId));
  } catch {
    // The form starts empty next time; nothing breaks.
  }
}

/** Up and Down (and Left and Right) in a radio group: focus and selection
 *  move together between its radio rows and wrap at the ends. Rows that are
 *  not radios (Add, More cards, Retry) are skipped; the page never scrolls. */
function onRadioKeys(e: React.KeyboardEvent<HTMLDivElement>) {
  const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
  if (dir === 0 || e.metaKey || e.ctrlKey || e.altKey) return;
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
  const at = radios.indexOf(e.target as HTMLElement);
  if (at < 0) return;
  e.preventDefault();
  const to = radios[(at + dir + radios.length) % radios.length];
  to.focus({ preventScroll: true });
  if (to !== e.target) to.click();
}

export function GuestPayScreen({
  placeId,
  places,
  placesFailed,
  getSupabase,
  onPaid,
  onBack,
  registerBack,
}: {
  placeId: string;
  places: PayPlace[] | null;
  placesFailed: boolean;
  getSupabase: () => Parameters<typeof apiListCards>[0];
  /** The guest tab exists (or the guest's one open payment, when Pay was
   *  refused for it): open its checklist. */
  onPaid: (tabId: string) => void;
  onBack: () => void;
  /** The header's back arrow asks this first: true when it handled it. */
  registerBack?: (back: (() => boolean) | null) => void;
}) {
  const place = places?.find((p) => p.place_id === placeId) ?? null;
  // The draft, read once and already checked (types, old step names, the
  // 30-minute limit, never past Tip unanswered): lib/pay-draft.ts.
  const [draft] = useState(() => readDraft(placeId));
  const [step, setStep] = useState<Step>(draft?.step ?? "bill");
  const [amount, setAmount] = useState(draft?.amount ?? "");
  const [tip, setTip] = useState<Tip>(draft?.tip ?? null);
  const [lastPct, setLastPct] = useState<Pct | null>(typeof draft?.tip === "number" ? draft.tip : null);
  const [other, setOther] = useState(draft?.other ?? "");
  const [useCredit, setUseCredit] = useState(draft?.useCredit ?? true);
  const [method, setMethod] = useState<PayWith | null>(draft?.method ?? null);
  const [cardId, setCardId] = useState<string | null>(draft?.cardId ?? null);
  const [tipMethod, setTipMethod] = useState<PayWith>("cash");
  // The saved cards: loading, failed (Retry), signed out, or the list. A
  // failed read is never an empty list (MESITA-3758, lib/pay-cards.ts).
  const [cardsLoad, setCardsLoad] = useState<CardsLoad>({ state: "loading" });
  const [cardsAttempt, setCardsAttempt] = useState(0);
  const latestCardsAttempt = useRef(0);
  const cards = loadedCards(cardsLoad);
  const [busy, setBusy] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [moreCards, setMoreCards] = useState(false);
  // A refusal belongs to the payment it refused: it shows only until the
  // guest changes something (no setState in an effect for that).
  const [failure, setFailure] = useState<{ msg: string; sig: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  // One request id per tap; a retry after a lost answer keeps it, any
  // change to the payment makes a new one.
  const requestId = useRef<string | null>(null);
  const root = useRef<HTMLFormElement | null>(null);

  const cardOk = place?.card_ok === true;
  const cashOk = place?.outside_ok === true;
  const spendable = Math.max(place?.available_cents ?? 0, 0);
  // Credit is the only way to pay here: its switch stays on.
  const creditOnly = !cardOk && !cashOk;

  // Saved cards, when the place takes cards, and again on each Retry. An
  // answer from an earlier attempt is dropped; a dead session goes through
  // the stale-session path and comes back to this place's pay page.
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
        if (failed.state === "signed_out") window.location.assign(clearSessionHref(`/pay/${placeId}`));
        setCardsLoad(failed);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardOk, cardsAttempt]);
  const retryCards = () => {
    setCardsLoad({ state: "loading" });
    setCardsAttempt((n) => n + 1);
  };

  const billCents = readAmount(amount) ?? 0;
  const tipCents =
    tip === null ? 0 : tip === "other" ? readTip(other) ?? 0 : Math.round((billCents * tip) / 100);
  const creditOn = (useCredit || creditOnly) && spendable > 0;
  const creditCovers = creditOn && spendable >= billCents && billCents > 0;
  const chosenCard = pickCard(cards, cardId);
  // The rest of the bill: the guest's pick, else card when cards work, else cash.
  const restWith: PayWith | null = method ?? (cardOk && chosenCard ? "card" : cashOk ? "cash" : cardOk ? "card" : null);
  const base = { place: place!, billCents, tipCents, spendableCents: spendable, useCredit: creditOn, restWith, cardId: chosenCard };
  // When credit pays the whole bill the tip is its own pick, among the ways
  // Pay would accept (tipWays); otherwise it follows the rest.
  const ways = place && creditCovers && tipCents > 0 ? tipWays(base) : [];
  const tipWith: PayWith = creditCovers ? (ways.includes(tipMethod) ? tipMethod : ways[0] ?? "cash") : restWith ?? "cash";
  const args = { ...base, tipWith };
  const split = place ? paySplit(args) : null;
  const problem = place ? payProblem(args) : null;
  const canPay = !!place && billCents > 0 && !problem && !busy && !addingCard;
  const m = (c: number) => money(c, place?.currency ?? "mxn");

  // Any change to the payment: a new tap (new request id), saved as a draft
  // so "Add a card" comes back with the amounts kept.
  const sig = JSON.stringify([amount, tip, other, useCredit, method, cardId, tipMethod]);
  const error = failure && failure.sig === sig ? failure.msg : null;
  const setError = (msg: string | null) => setFailure(msg ? { msg, sig } : null);
  // Every write carries its time; opening the screen is not a change, so
  // the first write keeps the time the draft already had.
  const savedAt = useRef<number | null>(null);
  useEffect(() => {
    requestId.current = null;
    const now = savedAt.current === null ? draft?.savedAt ?? Date.now() : Date.now();
    savedAt.current = now;
    writeDraft(placeId, { step, amount, tip, other, useCredit, method, cardId }, now);
  }, [placeId, draft, step, amount, tip, other, useCredit, method, cardId, tipMethod]);

  // The draft's age is asked again when the tab is looked at after a while
  // (or comes back from the page cache): past the limit it starts over at
  // Bill with nothing typed, no method, no card and the credit switch as
  // new, without a word. Never while a payment is going out.
  const sending = busy || addingCard;
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible" || sending) return;
      if (savedAt.current === null || !payDraftExpired(savedAt.current, Date.now())) return;
      setStep("bill");
      setAmount("");
      setTip(null);
      setLastPct(null);
      setOther("");
      setUseCredit(true);
      setMethod(null);
      setCardId(null);
      setTipMethod("cash");
      setConfirming(false);
      setFailure(null);
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, [sending]);

  // Focus sits on the step so desktop keys reach the keypad; it moves with
  // every step (and reads the step's question to a screen reader).
  const focusRoot = () => root.current?.focus({ preventScroll: true });
  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [step, place?.place_id]);

  // The header's back arrow: one step back, and off the screen from Bill.
  // While a payment is going out it does nothing.
  useEffect(() => {
    if (!registerBack) return;
    registerBack(() => {
      if (busy || addingCard) return true;
      const i = STEPS.indexOf(step);
      if (i <= 0) return false;
      setConfirming(false);
      setStep(STEPS[i - 1]);
      return true;
    });
    return () => registerBack(null);
  }, [registerBack, step, busy, addingCard]);

  // Opening the card page is not paying: its own state, so Pay never reads "Paying…" (MESITA-3714).
  async function addCard() {
    setAddingCard(true);
    try {
      const back = `${window.location.origin}/pay/${placeId}?${CARD_RETURN_PARAM}=1`;
      const { url } = await apiAddCard(getSupabase(), back);
      window.location.assign(url);
    } catch (e) {
      // A refusal with a reason of its own (too many cards, signed out)
      // says it; anything else is "the card page did not open".
      const code = e instanceof EFError ? e.code : null;
      setError((code && code !== "checkout_failed" && CARD_REFUSAL[code]) || CARD_PAGE_FAILURE);
      setAddingCard(false);
    }
  }

  async function pay(confirmed = false) {
    if (!canPay || !place || !split) return;
    if (split.total_cents > CONFIRM_ABOVE_CENTS && !confirmed) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setBusy(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    const cardParts = split.card_bill_cents + split.card_tip_cents;
    try {
      const r = await apiPayGuest(getSupabase(), {
        place_id: placeId,
        bill_cents: billCents,
        request_id: requestId.current,
        credit_cents: split.credit_cents,
        cash_bill_cents: split.cash_bill_cents,
        cash_tip_cents: split.cash_tip_cents,
        card_bill_cents: split.card_bill_cents,
        card_tip_cents: split.card_tip_cents,
        card_pm_id: cardParts > 0 ? chosenCard : null,
      });
      rememberGuestTab(r.tab_id, r.qr_url);
      writeDraft(placeId, null);
      if (r.card?.status === "requires_action") await runBankCheck(r.card);
      onPaid(r.tab_id);
    } catch (e) {
      const code = e instanceof EFError ? e.code : null;
      // A refusal ends this tap; a lost answer (no code) retries the same one.
      if (code) requestId.current = null;
      // MESITA-3772: one open payment at a time. The refusal names it, so
      // the guest lands on it (to get it signed or close it).
      const openId = code === "too_many_open" && e instanceof EFError ? e.body?.open_tab_id : null;
      if (typeof openId === "string" && openId) {
        onPaid(openId);
        return;
      }
      setError((code && TAB_REFUSAL[code]) || (e instanceof EFError && (e.status ?? 500) < 500 && e.message) || "Couldn't pay. Try again.");
      setBusy(false);
    }
  }

  if (!place) {
    if (placesFailed || (places && !place)) {
      return (
        <div className="flex flex-col gap-4" data-guest-pay="unavailable">
          <p className="text-base font-semibold">This place isn&apos;t taking Mesita payments right now.</p>
          <button type="button" className={QUIET_BUTTON_CLASS} onClick={onBack}>
            Back
          </button>
        </div>
      );
    }
    return <GuestPayLoading />;
  }

  if (creditOnly && spendable === 0) {
    return (
      <div className="flex flex-col gap-4" data-guest-pay="no-methods">
        <p className="text-base font-semibold">This place isn&apos;t taking Mesita payments right now.</p>
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  const otherOk = readTip(other) !== null;
  const nextOk =
    step === "bill"
      ? billCents > 0
      : step === "tip"
      ? tip !== null && (tip !== "other" || otherOk)
      : step === "methods"
      ? !problem && (creditCovers || !!restWith) && !methodsWaitOnCards({ cardOk, load: cardsLoad, method, creditCovers })
      : true;
  // Methods at a place where only a card can pay what is left, and the
  // guest has none saved (the list loaded, empty): the bottom button adds a
  // card instead of a Next that could never light. A guest whose credit
  // covers the bill has no such problem and keeps Next.
  const addCardFirst =
    step === "methods" && cardsLoad.state === "loaded" && cardsLoad.cards.length === 0 && problem?.code === "add_card";
  const next = () => {
    if (addCardFirst) {
      if (!busy && !addingCard) void addCard();
      return;
    }
    const i = STEPS.indexOf(step);
    if (!nextOk || i >= STEPS.length - 1) return;
    // The method the guest leaves Methods with stays: a card list that
    // arrives later never turns a cash payment into a card charge.
    if (step === "methods") setMethod(fixedMethod(method, restWith));
    setStep(STEPS[i + 1]);
  };
  const typing = step === "bill" || (step === "tip" && tip === "other");

  // Desktop keys: digits, "." and Backspace on a keypad step; Enter is Next
  // only from the step itself or a keypad key, so it still presses a
  // focused chip or row. Events from a sheet or dialog never reach here.
  // Arrow keys are not handled here: they belong to the radio groups.
  function onKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (!e.currentTarget.contains(target)) return;
    if (typing) {
      const key: PadKey | null = /^[0-9]$/.test(e.key) ? (e.key as PadKey) : e.key === "." ? "." : e.key === "Backspace" ? "back" : null;
      if (key) {
        e.preventDefault();
        if (step === "bill") setAmount((t) => pressKey(t, key));
        else setOther((t) => pressKey(t, key));
        return;
      }
    }
    if (e.key === "Enter" && step !== "pay" && (target === e.currentTarget || target.dataset.padKey !== undefined)) {
      e.preventDefault();
      next();
    }
  }

  const cardRows = cards ?? [];
  // The chosen card is always one of the two shown.
  const shownCards = (() => {
    const chosen = cardRows.find((c) => c.id === chosenCard);
    const rest = cardRows.filter((c) => c.id !== chosenCard);
    return (chosen ? [chosen, ...rest] : rest).slice(0, CARDS_SHOWN);
  })();
  const cardBack = place.cashback_bps > 0 ? `${place.cashback_bps / 100}% back` : undefined;
  const cashBack = (place.outside_bps ?? 0) > 0 ? `${(place.outside_bps ?? 0) / 100}% back` : undefined;
  // While the cards are unknown, "Add a card" would be a lie: the Retry row
  // (or the loading row) is the message.
  const cardsUnknown = cardOk && cards === null;
  const shownProblem = cardsUnknown && restWith === "card" ? null : problem;
  const status = step === "methods" || step === "pay" ? error ?? shownProblem?.message ?? null : error;
  // One row of each radio group is in the tab order: the chosen one, or the
  // first when none is chosen.
  const cardRowOn = restWith === "card" && shownCards.some((c) => c.id === chosenCard);
  const anyRowOn = cardRowOn || (restWith === "cash" && cashOk);
  const chosenCardRow = cardRows.find((c) => c.id === chosenCard);
  const cardLabel = chosenCardRow ? `${brandLabel(chosenCardRow.brand)} •••• ${chosenCardRow.last4}` : null;
  // The Pay step's button and its line: what this tap charges or spends in
  // the app, and how the rest goes (lib/pay-keypad.ts).
  const payNow = split ? payButton(split, { cardLabel, m }) : null;

  return (
    <>
      <form
        ref={root}
        tabIndex={-1}
        aria-label={payStepName(step, "guest")}
        className="flex min-h-0 flex-1 flex-col outline-none"
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
        data-guest-pay={step}
      >
        <PaySteps
          step={step}
          left={
            <>
              <PlacePhoto place={place} className="h-9 w-9" />
              <span className="min-w-0 flex-1 truncate text-base font-semibold">{place.name ?? "A Mesita place"}</span>
            </>
          }
        />

        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          {step === "bill" ? (
            <>
              {/* The amount at the top under the strip, the keypad at the
                  bottom above Next; spare height sits between them (MESITA-3766). */}
              <AmountDisplay text={amount} currency={place.currency} label="Bill" className="mt-6 shrink-0" />
              <div className="min-h-0 flex-1" aria-hidden />
              <AmountKeypad text={amount} onKey={(k) => setAmount((t) => pressKey(t, k))} />
            </>
          ) : null}

          {step === "tip" && tip !== "other" ? (
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tip">
                {TIP_PERCENTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={chip(tip === p, "flex h-16 flex-col items-center justify-center")}
                    aria-pressed={tip === p}
                    onClick={() => {
                      setTip(p);
                      setLastPct(p);
                    }}
                  >
                    <span className="text-lg">{p}%</span>
                    <span className={cn("text-sm font-normal tabular-nums", tip === p ? "opacity-80" : "text-muted-foreground")}>
                      {m(Math.round((billCents * p) / 100))}
                    </span>
                  </button>
                ))}
              <button type="button" className={chip(false, "h-16 text-lg")} aria-pressed={false} onClick={() => setTip("other")}>
                Other
              </button>
            </div>
          ) : null}

          {step === "tip" && tip === "other" ? (
            <>
              <AmountDisplay text={other} currency={place.currency} label="Tip" className="mt-6 shrink-0" />
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex min-h-11 shrink-0 items-center self-center text-sm font-semibold underline"
                onClick={() => {
                  setOther("");
                  setTip(lastPct);
                }}
              >
                Back to %
              </button>
              <div className="min-h-0 flex-1" aria-hidden />
              <AmountKeypad text={other} onKey={(k) => setOther((t) => pressKey(t, k))} />
            </>
          ) : null}

          {step === "methods" ? (
            <>
              <div className="border-border overflow-hidden rounded-2xl border" role="group" aria-label="Methods">
                {spendable > 0 ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={creditOn}
                    disabled={creditOnly}
                    onClick={() => setUseCredit((u) => !u)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left"
                  >
                    <MethodLabel chip={<PlainChip><Wallet /></PlainChip>} title={`${m(spendable)} credit`} line={creditOn ? "Applied" : "Not used"} />
                    <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", creditOn ? "bg-foreground" : "bg-border")} aria-hidden>
                      <span className={cn("bg-card absolute top-0.5 h-5 w-5 rounded-full transition", creditOn ? "left-[1.125rem]" : "left-0.5")} />
                    </span>
                  </button>
                ) : null}

                {!creditCovers ? (
                  <div role="radiogroup" aria-label={creditOn ? "The rest" : "Pay with"} onKeyDown={onRadioKeys}>
                    {/* The cards row keeps one height while loading, failed and retrying. */}
                    {cardsUnknown ? (
                      cardsLoad.state === "failed" ? (
                        <button
                          type="button"
                          className={cn("flex h-14 w-full items-center justify-between gap-3 px-4 text-left", spendable > 0 && "border-border border-t")}
                          onClick={retryCards}
                          data-cards-retry
                        >
                          <span className="min-w-0 truncate text-base">Couldn&apos;t load your cards</span>
                          <span className="shrink-0 text-base font-semibold underline">Retry</span>
                        </button>
                      ) : (
                        <div className={cn("flex h-14 items-center px-4", spendable > 0 && "border-border border-t")} aria-busy>
                          {cardsAttempt > 0 ? <span className="text-muted-foreground text-base">Loading…</span> : <Skeleton className="h-5 w-40" />}
                        </div>
                      )
                    ) : null}
                    {cardOk
                      ? shownCards.map((c, i) => (
                          <Row
                            key={c.id}
                            divided={i > 0 || spendable > 0}
                            on={restWith === "card" && chosenCard === c.id}
                            tab={!anyRowOn && i === 0}
                            chip={<SavedCardChip last4={c.last4} />}
                            title={`${brandLabel(c.brand)} •••• ${c.last4}`}
                            line={cardBack}
                            onPick={() => {
                              setMethod("card");
                              setCardId(c.id);
                            }}
                          />
                        ))
                      : null}
                    {cashOk ? (
                      <Row divided={spendable > 0 || shownCards.length > 0 || cardsUnknown} on={restWith === "cash"} tab={!anyRowOn && shownCards.length === 0} chip={<CashChip />} title="Cash" line={cashBack} onPick={() => setMethod("cash")} />
                    ) : null}
                    {cardOk && cards !== null ? (
                      cardRows.length > CARDS_SHOWN ? (
                        <button type="button" className="border-border flex min-h-14 w-full items-center justify-between gap-3 border-t px-4 py-2 text-left" onClick={() => setMoreCards(true)}>
                          <MethodLabel chip={<PlainChip><CreditCard /></PlainChip>} title="More cards" />
                          <ChevronRight className="text-muted-foreground h-5 w-5" aria-hidden />
                        </button>
                      ) : cardRows.length < MAX_SAVED_CARDS ? (
                        <button
                          type="button"
                          className="border-border flex min-h-14 w-full items-center gap-3 border-t px-4 py-2 text-left disabled:opacity-60"
                          disabled={busy || addingCard}
                          onClick={() => void addCard()}
                        >
                          <MethodLabel chip={<AddChip />} title={addingCard ? "Opening…" : "Add"} line="Add a card" />
                        </button>
                      ) : null
                    ) : null}
                  </div>
                ) : tipCents > 0 ? (
                  <div role="radiogroup" aria-label={`Tip ${m(tipCents)} with`} className="border-border border-t" onKeyDown={onRadioKeys}>
                    <p className="text-muted-foreground px-4 pt-2 text-sm">Tip {m(tipCents)} with</p>
                    {ways.includes("cash") ? (
                      <Row on={tipWith === "cash"} chip={<CashChip />} title="Cash" onPick={() => setTipMethod("cash")} />
                    ) : null}
                    {ways.includes("card") && chosenCard ? (
                      (() => {
                        const c = cardRows.find((x) => x.id === chosenCard);
                        return (
                          <Row
                            divided={ways.includes("cash")}
                            on={tipWith === "card"}
                            chip={c ? <SavedCardChip last4={c.last4} /> : <PlainChip><CreditCard /></PlainChip>}
                            title={c ? `${brandLabel(c.brand)} •••• ${c.last4}` : "Card"}
                            onPick={() => setTipMethod("card")}
                          />
                        );
                      })()
                    ) : null}
                  </div>
                ) : null}
              </div>
              {creditCovers && tipCents === 0 ? <p className="text-muted-foreground mt-2 text-sm">Your credit covers this bill.</p> : null}
            </>
          ) : null}

          {step === "pay" && split ? (
            <>
              <dl className="border-border flex flex-col rounded-2xl border px-4 py-3 text-base tabular-nums" data-guest-split>
                <Line label="Bill" value={m(billCents)} />
                <Line label="Tip" value={tipCents > 0 ? m(tipCents) : "No tip"} />
                <div className="border-border mt-1 flex h-8 items-center justify-between gap-3 border-t pt-1 text-lg font-semibold">
                  <dt>Total</dt>
                  <dd>{m(split.total_cents)}</dd>
                </div>
              </dl>
              {split.cashback_cents > 0 ? (
                <p className="mt-2 truncate text-sm font-semibold text-green-700" data-guest-cashback>
                  You get {m(split.cashback_cents)} in credits to spend here next time
                </p>
              ) : null}
            </>
          ) : null}

          <p
            className={cn("text-destructive mt-auto line-clamp-2 shrink-0 pt-2 text-sm", step === "bill" && !status && "hidden")}
            role={error ? "alert" : "status"}
          >
            {status}
          </p>
        </div>

        <div className="shrink-0 pt-4">
          {step === "pay" ? (
            <>
              {/* What the tap does not move, or how it is paid: above the button. */}
              {payNow?.line ? (
                <p className="text-muted-foreground mb-2 text-center text-sm break-words" data-guest-pay-line>
                  {payNow.line}
                </p>
              ) : null}
              <Button type="button" size="lg" className="min-h-12 w-full text-base font-semibold" disabled={!canPay} onClick={() => void pay()}>
                {busy ? <Spinner size="sm" label="Paying" /> : payNow?.button ?? "Pay"}
              </Button>
            </>
          ) : addCardFirst ? (
            <Button type="button" size="lg" className="min-h-12 w-full text-base font-semibold" disabled={busy || addingCard} onClick={next} data-guest-add-card>
              {addingCard ? "Opening…" : "Add a card"}
            </Button>
          ) : (
            <Button type="button" size="lg" className="min-h-12 w-full text-base font-semibold" disabled={!nextOk || busy || addingCard} onClick={next}>
              Next
            </Button>
          )}
        </div>
      </form>

      <LocalSheet
        open={moreCards}
        onClose={() => {
          setMoreCards(false);
          focusRoot();
        }}
        ariaLabel="Your cards"
      >
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <p className="pt-2 pb-3 text-lg font-semibold">Your cards</p>
          <div className="border-border scrollbar-hide min-h-0 overflow-y-auto rounded-2xl border" role="radiogroup" aria-label="Your cards">
            {cardRows.map((c, i) => (
              <Row
                key={c.id}
                divided={i > 0}
                on={restWith === "card" && chosenCard === c.id}
                chip={<SavedCardChip last4={c.last4} />}
                title={`${brandLabel(c.brand)} •••• ${c.last4}`}
                onPick={() => {
                  setMethod("card");
                  setCardId(c.id);
                  setMoreCards(false);
                  focusRoot();
                }}
              />
            ))}
          </div>
        </div>
      </LocalSheet>

      <LocalDialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
          focusRoot();
        }}
        ariaLabel="Confirm the amount"
      >
        <div className="p-5" data-guest-confirm>
          <p className="text-lg font-semibold">
            Is {split ? m(split.total_cents) : ""} at {place.name ?? "this place"} right?
          </p>
          {payNow?.line ? <p className="text-muted-foreground mt-1 text-sm break-words">{payNow.line}</p> : null}
          <div className="mt-4 flex gap-2">
            <Button type="button" className="min-h-12 flex-1 text-base font-semibold" disabled={busy} onClick={() => void pay(true)}>
              {busy ? <Spinner size="sm" label="Paying" /> : payNow?.button ?? "Pay"}
            </Button>
            <button
              type="button"
              className={cn(QUIET_BUTTON_CLASS, "flex-1")}
              onClick={() => {
                setConfirming(false);
                focusRoot();
              }}
            >
              Edit
            </button>
          </div>
        </div>
      </LocalDialog>
    </>
  );
}

/** A tip chip: ink when chosen, white with a hairline when not. */
function chip(on: boolean, extra: string) {
  return cn(
    "rounded-xl border px-3 text-base font-semibold transition",
    on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
    extra,
  );
}

/** One way to pay in the rows card: a radio row, ringed when chosen. */
function Row({
  on,
  tab = false,
  divided = false,
  chip,
  title,
  line,
  onPick,
}: {
  on: boolean;
  /** In the tab order though not chosen: the group's first row when none is. */
  tab?: boolean;
  divided?: boolean;
  chip: React.ReactNode;
  title: string;
  line?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      tabIndex={on || tab ? 0 : -1}
      onClick={onPick}
      className={cn(
        "relative flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left transition",
        divided && "border-border border-t",
        on ? "ring-foreground z-10 ring-1 ring-inset" : "hover:bg-muted/60",
      )}
    >
      <MethodLabel chip={chip} title={title} line={line} />
      <span className={cn("h-5 w-5 shrink-0 rounded-full border-2", on ? "border-foreground bg-foreground ring-card ring-2 ring-inset" : "border-border")} aria-hidden />
    </button>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-7 items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** One way to pay, drawn as the Wallet draws it: the method's own chip
 *  (green $ Cash, a black saved card, a dashed Add), its name, a quiet
 *  second line (Pato, MESITA-3748). */
function MethodLabel({ chip, title, line }: { chip: React.ReactNode; title: string; line?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-3.5">
      {chip}
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold">{title}</span>
        {line ? <span className="text-muted-foreground block truncate text-sm">{line}</span> : null}
      </span>
    </span>
  );
}

/** The step frame in bones while the place loads: the same shape, so
 *  nothing jumps (also the pay pages' loading.tsx). */
export function GuestPayLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-guest-pay="loading" aria-busy>
      <div className="flex h-9 items-center gap-2.5">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="ml-auto h-4 w-14" />
      </div>
      <Skeleton className="mt-3 h-1.5 w-full" />
      <div className="min-h-0 flex-1" />
      <Skeleton className="h-12 w-1/2 self-center" />
      <Skeleton className="mt-2 h-64 min-h-44 w-full shrink rounded-2xl" />
      <Skeleton className="mt-4 h-12 w-full rounded-xl" />
    </div>
  );
}
