"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

// THE GUEST PAYS ALONE (MESITA-3709). One screen at /pay/<placeId>, top to
// bottom: the amount the guest is paying (before tip), the tip, how to pay
// it (credit here first, then a saved card or cash for the rest; the tip
// follows that method), the split, the cashback, one button "Pay MX$total".
// Above MX$3,000 the button asks first. After Pay the guest lands on their
// payment's checklist (/pay/tab/<id>) and shows its QR to the waiter, who
// verifies it. Every rule and peso is the server's; this screen proposes.

const TIP_PERCENTS = [10, 15, 20] as const;
type Tip = "none" | (typeof TIP_PERCENTS)[number] | "other";
/** The amount past which Pay asks "Pay MX$X at <place>?" first. */
const CONFIRM_ABOVE_CENTS = 300_000;
const DRAFT_KEY = (placeId: string) => `mesita.pay.guest-draft.${placeId}`;

type Draft = { amount: string; tip: Tip; other: string; useCredit: boolean; method: PayWith | null; cardId: string | null };

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
}: {
  placeId: string;
  places: PayPlace[] | null;
  placesFailed: boolean;
  getSupabase: () => Parameters<typeof apiListCards>[0];
  /** The guest tab exists: open its checklist. */
  onPaid: (tabId: string) => void;
  onBack: () => void;
}) {
  const place = places?.find((p) => p.place_id === placeId) ?? null;
  const draft = useMemo(() => (typeof window === "undefined" ? null : readDraft(placeId)), [placeId]);
  const [amount, setAmount] = useState(draft?.amount ?? "");
  const [tip, setTip] = useState<Tip>(draft?.tip ?? "none");
  const [other, setOther] = useState(draft?.other ?? "");
  const [useCredit, setUseCredit] = useState(draft?.useCredit ?? true);
  const [method, setMethod] = useState<PayWith | null>(draft?.method ?? null);
  const [cardId, setCardId] = useState<string | null>(draft?.cardId ?? null);
  const [tipMethod, setTipMethod] = useState<PayWith>("cash");
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [busy, setBusy] = useState(false);
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
  const canPay = !!place && billCents > 0 && !problem && !busy;

  // Any change to the payment: a new tap (new request id), saved as a draft
  // so "Add a card" comes back with the amounts kept.
  const sig = JSON.stringify([amount, tip, other, useCredit, method, cardId, tipMethod]);
  const error = failure && failure.sig === sig ? failure.msg : null;
  const setError = (msg: string | null) => setFailure(msg ? { msg, sig } : null);
  useEffect(() => {
    requestId.current = null;
    writeDraft(placeId, { amount, tip, other, useCredit, method, cardId });
  }, [placeId, amount, tip, other, useCredit, method, cardId, tipMethod]);

  async function addCard() {
    setBusy(true);
    try {
      const back = `${window.location.origin}/pay/${placeId}?${CARD_RETURN_PARAM}=1`;
      const { url } = await apiAddCard(getSupabase(), back);
      window.location.assign(url);
    } catch {
      setError(NETWORK_FAILURE);
      setBusy(false);
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

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void pay();
      }}
      data-guest-pay="form"
    >
      {place.test_mode ? <TestBand className="mb-3" /> : null}
      <p className="text-base font-semibold">{place.name ?? "A Mesita place"}</p>

      <label className="mt-4 block text-base font-semibold" htmlFor="guest-amount">
        Amount you&apos;re paying, before tip
      </label>
      <input
        id="guest-amount"
        className={cn(FIELD_CLASS, "mt-2 text-lg tabular-nums")}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <p className="mt-5 text-base font-semibold" id="guest-tip">
        Tip
      </p>
      <div className="mt-2 flex gap-2" role="group" aria-labelledby="guest-tip">
        <button type="button" className={chip(tip === "none")} aria-pressed={tip === "none"} onClick={() => setTip("none")}>
          No tip
        </button>
        {TIP_PERCENTS.map((p) => (
          <button key={p} type="button" className={chip(tip === p)} aria-pressed={tip === p} onClick={() => setTip(p)}>
            {p}%
          </button>
        ))}
        <button type="button" className={chip(tip === "other")} aria-pressed={tip === "other"} onClick={() => setTip("other")}>
          Other
        </button>
      </div>
      {tip === "other" ? (
        <input
          aria-label="Tip in pesos"
          className={cn(FIELD_CLASS, "mt-2 tabular-nums")}
          inputMode="decimal"
          autoComplete="off"
          placeholder="Tip"
          value={other}
          onChange={(e) => setOther(e.target.value)}
        />
      ) : null}

      <p className="mt-5 text-base font-semibold">Pay with</p>
      {spendable > 0 ? (
        <label className="border-border bg-card mt-2 flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3">
          <span className="text-base">Use my {m(spendable)} credit here</span>
          <input type="checkbox" className="h-5 w-5" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
        </label>
      ) : null}

      {!creditCovers ? (
        <div className="mt-2 flex flex-col gap-2" role="radiogroup" aria-label={creditOn ? "The rest" : "Pay with"}>
          {cardOk
            ? (cards ?? []).map((c) => (
                <label key={c.id} className="border-border bg-card flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3">
                  <span className="text-base">
                    {brandLabel(c.brand)} •••• {c.last4}
                    {place.cashback_bps > 0 ? <span className="text-muted-foreground"> · {place.cashback_bps / 100}% back</span> : null}
                  </span>
                  <input
                    type="radio"
                    name="guest-method"
                    className="h-5 w-5"
                    checked={restWith === "card" && chosenCard === c.id}
                    onChange={() => {
                      setMethod("card");
                      setCardId(c.id);
                    }}
                  />
                </label>
              ))
            : null}
          {cardOk && cards !== null && cards.length === 0 ? (
            <button type="button" className={QUIET_BUTTON_CLASS} disabled={busy} onClick={() => void addCard()}>
              Add a card
            </button>
          ) : null}
          {cashOk ? (
            <label className="border-border bg-card flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3">
              <span className="text-base">
                Cash to the waiter
                {(place.outside_bps ?? 0) > 0 ? <span className="text-muted-foreground"> · {(place.outside_bps ?? 0) / 100}% back</span> : null}
              </span>
              <input type="radio" name="guest-method" className="h-5 w-5" checked={restWith === "cash"} onChange={() => setMethod("cash")} />
            </label>
          ) : null}
        </div>
      ) : tipCents > 0 ? (
        <div className="mt-2 flex gap-2" role="radiogroup" aria-label="The tip">
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
      ) : null}

      {billCents > 0 ? (
        <dl className="border-border mt-5 flex flex-col gap-1 border-t pt-3 text-base tabular-nums" data-guest-split>
          {split.credit_cents > 0 ? <Row label="Credit" value={m(split.credit_cents)} /> : null}
          {cardParts > 0 ? <Row label="Card" value={m(cardParts)} /> : null}
          {cashParts > 0 ? <Row label="Cash to the waiter" value={m(cashParts)} /> : null}
          {split.cashback_cents > 0 ? (
            <p className="mt-1 font-semibold text-green-700" data-guest-cashback>
              You get {m(split.cashback_cents)} back here
            </p>
          ) : null}
        </dl>
      ) : null}

      {problem ? (
        <p className="text-destructive mt-3 text-sm" role="status">
          {problem}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="border-foreground bg-card mt-5 rounded-2xl border-2 p-4" role="dialog" aria-label="Confirm the amount" data-guest-confirm>
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
        <Button type="submit" size="lg" className="mt-6 min-h-12 w-full text-base font-semibold" disabled={!canPay}>
          {busy ? "Paying…" : billCents > 0 ? `Pay ${m(split.total_cents)}` : "Pay"}
        </Button>
      )}
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
