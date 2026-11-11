"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, CreditCard, Plus, Wallet } from "lucide-react";
import { TestBand } from "@mesita/place-profile";
import { readAmount } from "@mesita/place-profile/lib/money";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiAddCard, apiListCards, brandLabel, CARD_RETURN_PARAM, type SavedCard } from "@/lib/api/cards";
import { apiPayGuest, type PayWith, runBankCheck, TAB_REFUSAL, tabSplit } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";
import { FIELD_CLASS, NETWORK_FAILURE, QUIET_BUTTON_CLASS, rememberGuestTab } from "./pay-common";

// THE GUEST PAYS ALONE (MESITA-3709), one step per screen at /pay/<placeId>
// (MESITA-3715): Bill (before tip) → Tip → How do you pay (credit here
// first, then a saved card or cash for the rest; the tip follows that
// method) → Review (the split, the cashback, "Pay MX$total"). The header's
// back arrow steps back. Above MX$3,000 Pay asks first. After Pay the guest lands on their
// payment's checklist (/pay/tab/<id>) and shows its QR to the waiter, who
// verifies it. Every rule and peso is the server's; this screen proposes.

const TIP_PERCENTS = [10, 15, 20] as const;
type Tip = "none" | (typeof TIP_PERCENTS)[number] | "other";
/** The amount past which Pay asks "Pay MX$X at <place>?" first. */
const CONFIRM_ABOVE_CENTS = 300_000;
const DRAFT_KEY = (placeId: string) => `mesita.pay.guest-draft.${placeId}`;

const STEPS = ["bill", "tip", "method", "review"] as const;
type Step = (typeof STEPS)[number];

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
  /** The header's back arrow asks this first: true when it stepped back. */
  registerBack?: (back: (() => boolean) | null) => void;
}) {
  const place = places?.find((p) => p.place_id === placeId) ?? null;
  const draft = useMemo(() => (typeof window === "undefined" ? null : readDraft(placeId)), [placeId]);
  const [step, setStep] = useState<Step>(draft?.step && STEPS.includes(draft.step) ? draft.step : "bill");
  const [amount, setAmount] = useState(draft?.amount ?? "");
  const [tip, setTip] = useState<Tip>(draft?.tip ?? "none");
  const [other, setOther] = useState(draft?.other ?? "");
  const [useCredit, setUseCredit] = useState(draft?.useCredit ?? true);
  const [method, setMethod] = useState<PayWith | null>(draft?.method ?? null);
  const [cardId, setCardId] = useState<string | null>(draft?.cardId ?? null);
  const [tipMethod, setTipMethod] = useState<PayWith>("cash");
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  // A refusal belongs to the payment it refused: it shows only until the
  // guest changes something (no setState in an effect for that).
  const [failure, setFailure] = useState<{ msg: string; sig: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  // One request id per tap; a retry after a lost answer keeps it, any
  // change to the payment makes a new one.
  const requestId = useRef<string | null>(null);

  const cardOk = place?.card_ok === true;
  const cashOk = place?.outside_ok === true;
  const spendable = Math.max(place?.available_cents ?? 0, 0);

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
    tip === "none" ? 0 : tip === "other" ? readAmount(other) ?? 0 : Math.round((billCents * tip) / 100);
  const creditOn = useCredit && spendable > 0;
  const creditCovers = creditOn && spendable >= billCents && billCents > 0;
  const firstCard = cards?.[0]?.id ?? null;
  const chosenCard = cardId && cards?.some((c) => c.id === cardId) ? cardId : firstCard;
  // The rest of the bill: the guest's pick, else card when cards work, else cash.
  const restWith: PayWith | null = method ?? (cardOk && chosenCard ? "card" : cashOk ? "cash" : cardOk ? "card" : null);
  // The tip follows the rest; only when credit covers the bill is it its own pick.
  const tipWith: PayWith = creditCovers ? tipMethod : restWith ?? "cash";

  const split = tabSplit({
    billCents,
    tipCents,
    spendableCents: spendable,
    useCredit: creditOn,
    cashBackBps: place?.outside_bps ?? 0,
    cardBackBps: place?.cashback_bps ?? 0,
    billWith: restWith ?? "cash",
    tipWith,
  });
  const cardParts = split.card_bill_cents + split.card_tip_cents;
  const cashParts = split.cash_bill_cents + split.cash_tip_cents;
  const m = (c: number) => money(c, place?.currency ?? "mxn");

  // What stops Pay, in the guest's words (null = good to go).
  const problem = (() => {
    if (billCents <= 0) return null;
    if (tip === "other" && other.trim() !== "" && readAmount(other) === null) return "Type the tip in pesos.";
    if (cardParts > 0 && !chosenCard) return "Add a card to pay by card.";
    if (cashParts > 0 && !cashOk) return TAB_REFUSAL.cash_off;
    if (cardParts > 0 && place && cardParts < place.card_min_cents) return `Cards need at least ${m(place.card_min_cents)} here.`;
    if (split.card_tip_alone) return TAB_REFUSAL.card_tip_alone;
    return null;
  })();
  const canPay = !!place && billCents > 0 && !problem && !busy && !addingCard;

  // Any change to the payment: a new tap (new request id), saved as a draft
  // so "Add a card" comes back with the amounts kept.
  const sig = JSON.stringify([amount, tip, other, useCredit, method, cardId, tipMethod]);
  const error = failure && failure.sig === sig ? failure.msg : null;
  const setError = (msg: string | null) => setFailure(msg ? { msg, sig } : null);
  useEffect(() => {
    requestId.current = null;
    writeDraft(placeId, { step, amount, tip, other, useCredit, method, cardId });
  }, [placeId, step, amount, tip, other, useCredit, method, cardId, tipMethod]);

  // The header's back arrow: one step back, and off the screen from Bill.
  useEffect(() => {
    if (!registerBack) return;
    registerBack(() => {
      const i = STEPS.indexOf(step);
      if (i <= 0) return false;
      setConfirming(false);
      setStep(STEPS[i - 1]);
      return true;
    });
    return () => registerBack(null);
  }, [registerBack, step]);

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

  async function pay() {
    if (!canPay || !place) return;
    if (split.total_cents > CONFIRM_ABOVE_CENTS && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setBusy(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
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
    return (
      <div className="flex flex-col gap-3" data-guest-pay="loading" aria-busy>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!cardOk && !cashOk && spendable === 0) {
    return (
      <div className="flex flex-col gap-4" data-guest-pay="no-methods">
        <p className="text-base font-semibold">This place isn&apos;t taking Mesita payments right now.</p>
        <button type="button" className={QUIET_BUTTON_CLASS} onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  const chip = (on: boolean) =>
    cn(
      "min-h-11 flex-1 rounded-xl border px-3 text-base font-semibold transition",
      on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
    );
  const row = (on: boolean) =>
    cn("bg-card flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-4 transition", on ? "border-foreground ring-foreground ring-1" : "border-border");

  const tipProblem = tip === "other" && other.trim() !== "" && readAmount(other) === null ? "Type the tip in pesos." : null;
  const nextOk =
    step === "bill" ? billCents > 0 : step === "tip" ? !tipProblem && (tip !== "other" || other.trim() !== "") : step === "method" ? !problem && (!!restWith || creditCovers) : true;
  const next = () => {
    const i = STEPS.indexOf(step);
    if (nextOk && i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const stepIndex = STEPS.indexOf(step);

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "review") void pay();
        else next();
      }}
      data-guest-pay={step}
    >
      {place.test_mode ? <TestBand className="mb-3" /> : null}
      <div className="flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={cn("h-1 flex-1 rounded-full", i <= stepIndex ? "bg-foreground" : "bg-border")} />
        ))}
      </div>
      <p className="text-muted-foreground mt-3 text-sm">
        {place.name ?? "A Mesita place"} · Step {stepIndex + 1} of {STEPS.length}
      </p>

      {step === "bill" ? (
        <>
          <label className="mt-1 block text-2xl font-semibold" htmlFor="guest-amount">
            How much is the bill?
          </label>
          <p className="text-muted-foreground mt-1 text-base">Before tip, as on the ticket.</p>
          <input
            id="guest-amount"
            className={cn(FIELD_CLASS, "mt-5 h-16 text-3xl font-semibold tabular-nums")}
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </>
      ) : null}

      {step === "tip" ? (
        <>
          <p className="mt-1 text-2xl font-semibold" id="guest-tip">
            Add a tip?
          </p>
          <p className="text-muted-foreground mt-1 text-base">On a {m(billCents)} bill.</p>
          <div className="mt-5 grid grid-cols-2 gap-2" role="group" aria-labelledby="guest-tip">
            {TIP_PERCENTS.map((p) => (
              <button key={p} type="button" className={cn(chip(tip === p), "flex min-h-20 flex-col items-center justify-center")} aria-pressed={tip === p} onClick={() => setTip(p)}>
                <span className="text-xl">{p}%</span>
                <span className={cn("text-sm font-normal tabular-nums", tip === p ? "opacity-80" : "text-muted-foreground")}>{m(Math.round((billCents * p) / 100))}</span>
              </button>
            ))}
            <button type="button" className={cn(chip(tip === "other"), "min-h-20 text-xl")} aria-pressed={tip === "other"} onClick={() => setTip("other")}>
              Other
            </button>
            <button type="button" className={cn(chip(tip === "none"), "col-span-2 min-h-14")} aria-pressed={tip === "none"} onClick={() => setTip("none")}>
              No tip
            </button>
          </div>
          {tip === "other" ? (
            <input
              aria-label="Tip in pesos"
              className={cn(FIELD_CLASS, "mt-3 text-lg tabular-nums")}
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              placeholder="Tip in pesos"
              value={other}
              onChange={(e) => setOther(e.target.value)}
            />
          ) : null}
          {tipProblem ? (
            <p className="text-destructive mt-3 text-sm" role="status">
              {tipProblem}
            </p>
          ) : null}
        </>
      ) : null}

      {step === "method" ? (
        <>
          <p className="mt-1 text-2xl font-semibold">How do you pay?</p>
          <p className="text-muted-foreground mt-1 text-base tabular-nums">
            {m(billCents)}
            {tipCents > 0 ? ` + ${m(tipCents)} tip` : ""}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {spendable > 0 ? (
              <label className={row(creditOn)}>
                <MethodLabel icon={<Wallet />}>Use my {m(spendable)} credit here</MethodLabel>
                <input type="checkbox" className="h-5 w-5" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
              </label>
            ) : null}
            {!creditCovers ? (
              <div className="flex flex-col gap-2" role="radiogroup" aria-label={creditOn ? "The rest" : "Pay with"}>
                {creditOn ? <p className="text-muted-foreground mt-2 text-sm">The rest</p> : null}
                {cardOk
                  ? (cards ?? []).map((c) => {
                      const on = restWith === "card" && chosenCard === c.id;
                      return (
                        <label key={c.id} className={row(on)}>
                          <MethodLabel icon={<CreditCard />}>
                            {brandLabel(c.brand)} •••• {c.last4}
                            {place.cashback_bps > 0 ? <span className="text-muted-foreground"> · {place.cashback_bps / 100}% back</span> : null}
                          </MethodLabel>
                          <input
                            type="radio"
                            name="guest-method"
                            className="h-5 w-5"
                            checked={on}
                            onChange={() => {
                              setMethod("card");
                              setCardId(c.id);
                            }}
                          />
                        </label>
                      );
                    })
                  : null}
                {cashOk ? (
                  <label className={row(restWith === "cash")}>
                    <MethodLabel icon={<Banknote />}>
                      Cash to the waiter
                      {(place.outside_bps ?? 0) > 0 ? <span className="text-muted-foreground"> · {(place.outside_bps ?? 0) / 100}% back</span> : null}
                    </MethodLabel>
                    <input type="radio" name="guest-method" className="h-5 w-5" checked={restWith === "cash"} onChange={() => setMethod("cash")} />
                  </label>
                ) : null}
                {cardOk && cards !== null && cards.length === 0 ? (
                  <button type="button" className={cn(row(false), "justify-start text-left disabled:opacity-60")} disabled={busy || addingCard} onClick={() => void addCard()}>
                    <MethodLabel icon={<Plus />}>{addingCard ? "Opening…" : "Add a card"}</MethodLabel>
                  </button>
                ) : null}
              </div>
            ) : tipCents > 0 ? (
              <>
                <p className="text-muted-foreground mt-2 text-sm">The tip</p>
                <div className="flex gap-2" role="radiogroup" aria-label="The tip">
                  {cashOk ? (
                    <button type="button" className={chip(tipMethod === "cash")} aria-pressed={tipMethod === "cash"} onClick={() => setTipMethod("cash")}>
                      Tip in cash
                    </button>
                  ) : null}
                  {cardOk && chosenCard ? (
                    <button type="button" className={chip(tipMethod === "card")} aria-pressed={tipMethod === "card"} onClick={() => setTipMethod("card")}>
                      Tip by card
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
          {problem ? (
            <p className="text-destructive mt-3 text-sm" role="status">
              {problem}
            </p>
          ) : null}
        </>
      ) : null}

      {step === "review" ? (
        <>
          <p className="mt-1 text-2xl font-semibold">Review and pay</p>
          <dl className="border-border bg-card mt-5 flex flex-col gap-2 rounded-2xl border p-4 text-base tabular-nums" data-guest-split>
            <Row label="Bill" value={m(billCents)} />
            <Row label="Tip" value={tipCents > 0 ? m(tipCents) : "No tip"} />
            <div className="border-border my-1 border-t" />
            {split.credit_cents > 0 ? <Row label="Credit" value={m(split.credit_cents)} icon={<Wallet />} /> : null}
            {cardParts > 0 ? <Row label="Card" value={m(cardParts)} icon={<CreditCard />} /> : null}
            {cashParts > 0 ? <Row label="Cash to the waiter" value={m(cashParts)} icon={<Banknote />} /> : null}
            <div className="border-border my-1 border-t" />
            <div className="flex justify-between gap-3 text-lg font-semibold">
              <dt>Total</dt>
              <dd>{m(split.total_cents)}</dd>
            </div>
          </dl>
          {split.cashback_cents > 0 ? (
            <p className="mt-3 font-semibold text-green-700" data-guest-cashback>
              You get {m(split.cashback_cents)} in credits to spend here next time
            </p>
          ) : null}
          {cashParts > 0 ? <p className="text-muted-foreground mt-2 text-sm">Next you show a QR to the waiter, who verifies it.</p> : null}
          {problem ? (
            <p className="text-destructive mt-3 text-sm" role="status">
              {problem}
            </p>
          ) : null}
        </>
      ) : null}

      {error ? (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-auto pt-6">
        {step !== "review" ? (
          <Button type="submit" size="lg" className="min-h-12 w-full text-base font-semibold" disabled={!nextOk || busy || addingCard}>
            Next
          </Button>
        ) : confirming ? (
          <div className="border-foreground bg-card rounded-2xl border-2 p-4" role="dialog" aria-label="Confirm the amount" data-guest-confirm>
            <p className="text-base font-semibold">
              Pay {m(split.total_cents)} at {place.name ?? "this place"}?
            </p>
            <div className="mt-3 flex gap-2">
              <Button type="submit" className="min-h-12 flex-1 text-base font-semibold" disabled={busy}>
                Pay {m(split.total_cents)}
              </Button>
              <button type="button" className={cn(QUIET_BUTTON_CLASS, "flex-1")} onClick={() => setConfirming(false)}>
                Edit
              </button>
            </div>
          </div>
        ) : (
          <Button type="submit" size="lg" className="min-h-12 w-full text-base font-semibold" disabled={!canPay}>
            {busy ? "Paying…" : `Pay ${m(split.total_cents)}`}
          </Button>
        )}
      </div>
    </form>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground flex items-center gap-2 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

/** One way to pay: a grey ink icon chip, then its words (MESITA-3714). */
function MethodLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
        {icon}
      </span>
      <span className="text-base">{children}</span>
    </span>
  );
}
