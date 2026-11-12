"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, CreditCard, Wallet } from "lucide-react";
import { readAmount } from "@mesita/place-profile/lib/money";
import { AddChip, CashChip, PlainChip, SavedCardChip } from "@/components/consumer/wallet/WalletLists";
import { Skeleton } from "@/components/shared/Skeleton";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { LocalDialog, LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { apiAddCard, apiListCards, brandLabel, CARD_RETURN_PARAM, type SavedCard } from "@/lib/api/cards";
import { apiPayGuest, type PayWith, runBankCheck, TAB_REFUSAL } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";
import { draftAmount, draftTip, type PadKey, payProblem, paySplit, pressKey, readTip, tipWays } from "@/lib/pay-keypad";
import { cn } from "@/lib/utils";
import { AmountDisplay, AmountKeypad } from "./AmountKeypad";
import { NETWORK_FAILURE, PlacePhoto, QUIET_BUTTON_CLASS, rememberGuestTab } from "./pay-common";

// THE GUEST PAYS ALONE (MESITA-3709), one step per screen at /pay/<placeId>
// (MESITA-3715): Bill (before tip) → Tip → How do you pay → Review (the
// split, the cashback, "Pay MX$total"). The header's back arrow steps back.
// After Pay the guest lands on their payment's checklist (/pay/tab/<id>) and
// shows its QR to the waiter, who verifies it. Every rule and peso is the
// server's; this screen proposes.
//
// ONE SCREEN A STEP, NOTHING SCROLLS (MESITA-3739, Pato: "make it not
// scrollable, try to fit all in one page"): white, no tab bar, and each step
// is a fixed column — the place and "Step N of 4" on top, one question, the
// step's body, Next pinned at the bottom. Amounts are typed on a keypad drawn
// in the page (the phone keyboard covered Next). Credit is the first row of
// "How do you pay", on by default; above MX$3,000 Pay asks first in a dialog.
//
//   ┌ top: photo · name ········ Step N of 4 ┐   fixed 56px
//   │ ▬▬▬▬ ▬▬▬▬ ▭▭▭▭ ▭▭▭▭                     │
//   │ Question                                │   32px line
//   │ body (flex-1: keypad rows / rows card)  │   shares what is left
//   │ [ status line ]                         │
//   └ [ Next / Pay ]                          ┘   pinned

const TIP_PERCENTS = [10, 15, 20] as const;
type Pct = (typeof TIP_PERCENTS)[number];
/** null: not answered yet. There is no "No tip" button: no tip is Other
 *  with 0 typed (Pato, MESITA-3748). */
type Tip = Pct | "other" | null;
/** The amount past which Pay asks "Pay MX$X at <place>?" first. */
const CONFIRM_ABOVE_CENTS = 300_000;
const DRAFT_KEY = (placeId: string) => `mesita.pay.guest-draft.${placeId}`;
/** Saved cards shown in the rows card; more open in a sheet. */
const CARDS_SHOWN = 2;

const STEPS = ["bill", "tip", "method", "review"] as const;
type Step = (typeof STEPS)[number];
const QUESTION: Record<Step, string> = {
  bill: "How much is the bill?",
  tip: "Add a tip?",
  method: "How do you pay?",
  review: "Review and pay",
};

type Draft = { step?: Step; amount: string; tip: Tip; other: string; useCredit: boolean; method: PayWith | null; cardId: string | null };

function readDraft(placeId: string): Partial<Draft> | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY(placeId));
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null;
  } catch {
    return null;
  }
}

function writeDraft(placeId: string, d: Draft | null) {
  try {
    if (d) window.sessionStorage.setItem(DRAFT_KEY(placeId), JSON.stringify(d));
    else window.sessionStorage.removeItem(DRAFT_KEY(placeId));
  } catch {
    // The form starts empty next time; nothing breaks.
  }
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
  /** The guest tab exists: open its checklist. */
  onPaid: (tabId: string) => void;
  onBack: () => void;
  /** The header's back arrow asks this first: true when it handled it. */
  registerBack?: (back: (() => boolean) | null) => void;
}) {
  const place = places?.find((p) => p.place_id === placeId) ?? null;
  const draft = useMemo(() => (typeof window === "undefined" ? null : readDraft(placeId)), [placeId]);
  // A draft from before MESITA-3748 may say "none": that is unanswered now.
  const draftTipPick: Tip = draft?.tip === "other" || TIP_PERCENTS.some((p) => p === draft?.tip) ? (draft?.tip as Tip) : null;
  const [step, setStep] = useState<Step>(() => {
    const s = draft?.step && STEPS.includes(draft.step) ? draft.step : "bill";
    // Never past Tip with the tip unanswered.
    return draftTipPick === null && STEPS.indexOf(s) > STEPS.indexOf("tip") ? "tip" : s;
  });
  // A draft from before the keypad (or typed "1,250") is put into the
  // keypad's own form, so a key never extends text it could not have made.
  const [amount, setAmount] = useState(() => draftAmount(draft?.amount));
  const [tip, setTip] = useState<Tip>(draftTipPick);
  const [lastPct, setLastPct] = useState<Pct | null>(typeof draft?.tip === "number" ? draft.tip : null);
  const [other, setOther] = useState(() => draftTip(draft?.other));
  const [useCredit, setUseCredit] = useState(draft?.useCredit ?? true);
  const [method, setMethod] = useState<PayWith | null>(draft?.method ?? null);
  const [cardId, setCardId] = useState<string | null>(draft?.cardId ?? null);
  const [tipMethod, setTipMethod] = useState<PayWith>("cash");
  const [cards, setCards] = useState<SavedCard[] | null>(null);
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

  // Saved cards, once, when the place takes cards.
  useEffect(() => {
    if (!cardOk || cards !== null) return;
    let cancelled = false;
    void apiListCards(getSupabase())
      .then((r) => {
        if (!cancelled) setCards(r.cards);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardOk]);

  const billCents = readAmount(amount) ?? 0;
  const tipCents =
    tip === null ? 0 : tip === "other" ? readTip(other) ?? 0 : Math.round((billCents * tip) / 100);
  const creditOn = (useCredit || creditOnly) && spendable > 0;
  const creditCovers = creditOn && spendable >= billCents && billCents > 0;
  const firstCard = cards?.[0]?.id ?? null;
  const chosenCard = cardId && cards?.some((c) => c.id === cardId) ? cardId : firstCard;
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
  useEffect(() => {
    requestId.current = null;
    writeDraft(placeId, { step, amount, tip, other, useCredit, method, cardId });
  }, [placeId, step, amount, tip, other, useCredit, method, cardId, tipMethod]);

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
    } catch {
      setError(NETWORK_FAILURE);
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
      : step === "method"
      ? !problem && (creditCovers || !!restWith)
      : true;
  const next = () => {
    const i = STEPS.indexOf(step);
    if (nextOk && i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const stepIndex = STEPS.indexOf(step);
  const typing = step === "bill" || (step === "tip" && tip === "other");

  // Desktop keys: digits, "." and Backspace on a keypad step; Enter is Next
  // only from the step itself or a keypad key, so it still presses a
  // focused chip or row. Events from a sheet or dialog never reach here.
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
    if (e.key === "Enter" && step !== "review" && (target === e.currentTarget || target.dataset.padKey !== undefined)) {
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
  const status = step === "method" || step === "review" ? error ?? problem : error;

  return (
    <>
      <form
        ref={root}
        tabIndex={-1}
        aria-labelledby="guest-pay-question"
        className="flex min-h-0 flex-1 flex-col outline-none"
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
        data-guest-pay={step}
      >
        <div className="flex h-9 shrink-0 items-center gap-2.5">
          <PlacePhoto place={place} className="h-9 w-9" />
          <span className="min-w-0 flex-1 truncate text-base font-semibold">{place.name ?? "A Mesita place"}</span>
          <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
        </div>
        <div className="mt-3 flex shrink-0 gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={cn("h-1 flex-1 rounded-full", i <= stepIndex ? "bg-foreground" : "bg-border")} />
          ))}
        </div>

        <h2 id="guest-pay-question" className="mt-4 shrink-0 text-2xl font-semibold">
          {QUESTION[step]}
        </h2>

        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          {step === "bill" ? (
            <>
              <AmountDisplay text={amount} currency={place.currency} label="Bill" className="h-13 shrink-0" />
              <div className="mt-3 flex min-h-0 flex-1 flex-col">
                <AmountKeypad text={amount} onKey={(k) => setAmount((t) => pressKey(t, k))} />
              </div>
            </>
          ) : null}

          {step === "tip" && tip !== "other" ? (
            <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="guest-pay-question">
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
              <div className="flex h-11 shrink-0 items-center justify-between gap-3">
                <AmountDisplay text={other} currency={place.currency} label="Tip" className="[&>span:nth-child(2)]:text-4xl" />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground flex min-h-11 shrink-0 items-center text-sm font-semibold underline"
                  onClick={() => {
                    setOther("");
                    setTip(lastPct);
                  }}
                >
                  Back to %
                </button>
              </div>
              <div className="mt-2 flex min-h-0 flex-1 flex-col">
                <AmountKeypad text={other} onKey={(k) => setOther((t) => pressKey(t, k))} />
              </div>
            </>
          ) : null}

          {step === "method" ? (
            <>
              <div className="border-border overflow-hidden rounded-2xl border" role="group" aria-labelledby="guest-pay-question">
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
                  <div role="radiogroup" aria-label={creditOn ? "The rest" : "Pay with"}>
                    {cardOk && cards === null
                      ? [0, 1].map((i) => (
                          <div key={i} className={cn("flex h-14 items-center px-4", (i > 0 || spendable > 0) && "border-border border-t")}>
                            <Skeleton className="h-5 w-40" />
                          </div>
                        ))
                      : null}
                    {cardOk
                      ? shownCards.map((c, i) => (
                          <Row
                            key={c.id}
                            divided={i > 0 || spendable > 0}
                            on={restWith === "card" && chosenCard === c.id}
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
                      <Row divided={spendable > 0 || shownCards.length > 0 || (cardOk && cards === null)} on={restWith === "cash"} chip={<CashChip />} title="Cash" line={cashBack} onPick={() => setMethod("cash")} />
                    ) : null}
                    {cardOk && cards !== null ? (
                      cardRows.length > CARDS_SHOWN ? (
                        <button type="button" className="border-border flex min-h-14 w-full items-center justify-between gap-3 border-t px-4 py-2 text-left" onClick={() => setMoreCards(true)}>
                          <MethodLabel chip={<PlainChip><CreditCard /></PlainChip>} title="More cards" />
                          <ChevronRight className="text-muted-foreground h-5 w-5" aria-hidden />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="border-border flex min-h-14 w-full items-center gap-3 border-t px-4 py-2 text-left disabled:opacity-60"
                          disabled={busy || addingCard}
                          onClick={() => void addCard()}
                        >
                          <MethodLabel chip={<AddChip />} title={addingCard ? "Opening…" : "Add"} line="Add a card" />
                        </button>
                      )
                    ) : null}
                  </div>
                ) : tipCents > 0 ? (
                  <div role="radiogroup" aria-label={`Tip ${m(tipCents)} with`} className="border-border border-t">
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

          {step === "review" && split ? (
            <>
              <dl className="border-border flex flex-col rounded-2xl border px-4 py-3 text-base tabular-nums" data-guest-split>
                <Line label="Bill" value={m(billCents)} />
                <Line label="Tip" value={tipCents > 0 ? m(tipCents) : "No tip"} />
                {split.credit_cents > 0 ? <Line label="Credit" value={`−${m(split.credit_cents)}`} icon={<Wallet />} /> : null}
                {split.card_bill_cents + split.card_tip_cents > 0 ? (
                  <Line label="Card" value={m(split.card_bill_cents + split.card_tip_cents)} icon={<CreditCard />} />
                ) : null}
                {split.cash_bill_cents + split.cash_tip_cents > 0 ? (
                  <Line
                    label="Cash"
                    value={m(split.cash_bill_cents + split.cash_tip_cents)}
                    icon={<span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-400 text-[0.625rem] font-bold text-neutral-950" aria-hidden>$</span>}
                  />
                ) : null}
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
          {step !== "review" ? (
            <Button type="button" size="lg" className="min-h-12 w-full text-base font-semibold" disabled={!nextOk || busy || addingCard} onClick={next}>
              Next
            </Button>
          ) : (
            <Button type="button" size="lg" className="min-h-12 w-full text-base font-semibold" disabled={!canPay} onClick={() => void pay()}>
              {busy ? <Spinner size="sm" label="Paying" /> : `Pay ${split ? m(split.total_cents) : ""}`}
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
            <button
              type="button"
              className="border-border flex min-h-14 w-full items-center gap-3 border-t px-4 py-2 text-left disabled:opacity-60"
              disabled={busy || addingCard}
              onClick={() => void addCard()}
            >
              <MethodLabel chip={<AddChip />} title={addingCard ? "Opening…" : "Add"} line="Add a card" />
            </button>
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
            Pay {split ? m(split.total_cents) : ""} at {place.name ?? "this place"}?
          </p>
          <div className="mt-4 flex gap-2">
            <Button type="button" className="min-h-12 flex-1 text-base font-semibold" disabled={busy} onClick={() => void pay(true)}>
              {busy ? <Spinner size="sm" label="Paying" /> : `Pay ${split ? m(split.total_cents) : ""}`}
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
  divided = false,
  chip,
  title,
  line,
  onPick,
}: {
  on: boolean;
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

function Line({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex h-7 items-center justify-between gap-3">
      <dt className="text-muted-foreground flex items-center gap-2 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
        {label}
      </dt>
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
      </div>
      <Skeleton className="mt-3 h-1 w-full" />
      <Skeleton className="mt-4 h-8 w-2/3" />
      <Skeleton className="mt-3 h-13 w-1/2 self-center" />
      <Skeleton className="mt-3 min-h-0 w-full flex-1 rounded-2xl" />
      <Skeleton className="mt-4 h-12 w-full rounded-xl" />
    </div>
  );
}
