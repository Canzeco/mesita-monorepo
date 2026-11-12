"use client";

import { useRef, useState } from "react";
import { ArrowLeft, CreditCard, Wallet as WalletIcon, X } from "lucide-react";
import { cashbackFor, paySplit } from "@mesita/place-profile";
import { amountText, readAmount } from "@mesita/place-profile/lib/money";
import { readTip } from "@/lib/pay-keypad";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import {
  apiLookCharge,
  apiStartPayment,
  attemptFor,
  CHARGE_REFUSAL,
  money,
  PAY_REFUSAL,
  type PayAttempt,
  type PayPlace,
  type PayProof,
  type WaiterCharge,
} from "@/lib/api/wallet";
import { CONSUMER_ROUTES, payReceiptPath } from "@/lib/consumer-route-contract";
import { replaceAddress } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { FIELD_CLASS, NETWORK_FAILURE, PlacePhoto, QUIET_BUTTON_CLASS, type Refill } from "./pay-common";

// THE PAY FORM (MESITA-3457, the steps MESITA-3536): the older door to pay
// a place, kept behind "Waiter gave you a code?" on the bill at the table
// (MESITA-3564) and reopened by a cancelled Checkout (MESITA-3458). A sheet
// over the screen that opened it, one question a step: the bill, the tip
// (only where the place takes a card), pay the bill with (Card, or Credit
// there: credit first, the card the rest), pay the tip with (Card; tips go
// by card), then the summary and "Go to checkout" (or "Pay … with credit").
// Every amount shown is a server field or the shared paySplit twin the
// server's own rule is tested against; the server is the last word. The
// card part leaves for Stripe from the receipt's own address, so Stripe's
// Back lands on the receipt.

/** The form as a sheet: open while `place` is set. */
export function PayFormSheet({
  place,
  refill,
  onClose,
  onPaid,
  onTaken,
  onRefresh,
}: {
  place: PayPlace | null;
  refill: Refill | null;
  onClose: () => void;
  onPaid: (p: PayProof) => void;
  onTaken: (paymentId: string) => void;
  onRefresh: () => void;
}) {
  return (
    <LocalSheet open={place !== null} onClose={onClose} ariaLabel={`Pay at ${place?.name ?? "a Mesita place"}`}>
      {place ? (
        <PayForm
          key={place.place_id}
          place={place}
          refill={refill && refill.placeId === place.place_id ? refill : null}
          onBack={onClose}
          onPaid={onPaid}
          onTaken={onTaken}
          onRefresh={onRefresh}
        />
      ) : null}
    </LocalSheet>
  );
}

/** The tip buttons, in percent of the bill (MESITA-3536). */
const TIP_PERCENTS = [10, 15, 20] as const;
type TipChoice = (typeof TIP_PERCENTS)[number] | "other";
type Step = "bill" | "tip" | "billWith" | "tipWith";
type BillWith = "credit" | "card";

const STEP_TITLE: Record<Step, string> = {
  bill: "How much is the bill?",
  tip: "Add a tip?",
  billWith: "Pay the bill with",
  tipWith: "Pay the tip with",
};

/** One choice in "Pay … with": a radio row, greyed with its reason when off. */
function MethodRow({
  name,
  icon: Icon,
  title,
  note,
  checked,
  disabled,
  onPick,
}: {
  name: string;
  icon: typeof CreditCard;
  title: string;
  note: string;
  checked: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <label className={cn("flex min-h-[4.75rem] items-center gap-3.5 px-4 py-3", checked && "bg-muted/60", disabled ? "opacity-50" : "cursor-pointer")}>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", checked ? "bg-foreground text-background" : "bg-muted")}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="text-muted-foreground mt-0.5 block text-sm">{note}</span>
      </span>
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onPick}
        className="accent-foreground h-5 w-5 shrink-0"
      />
    </label>
  );
}

function PayForm({
  place,
  refill,
  onBack,
  onPaid,
  onTaken,
  onRefresh,
}: {
  place: PayPlace;
  /** The cancelled Checkout's amount, tip and ticket (MESITA-3458). */
  refill: Refill | null;
  onBack: () => void;
  onPaid: (p: PayProof) => void;
  onTaken: (paymentId: string) => void;
  onRefresh: () => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  // The steps (MESITA-3536): the bill, the tip (only where the place takes a
  // card: a tip goes by card), how to pay the bill, how to pay the tip, and
  // there the summary and the button.
  const steps: Step[] = place.card_ok ? ["bill", "tip", "billWith", "tipWith"] : ["bill", "billWith"];
  const [step, setStep] = useState(() => (refill ? steps.length - 1 : 0));
  const [amount, setAmount] = useState(() => (refill ? amountText(refill.amountCents) : ""));
  const [tipChoice, setTipChoice] = useState<TipChoice | null>(() => (refill ? "other" : null));
  // No tip is Other with 0 typed (MESITA-3748); a refill carries its tip, 0 included.
  const [tip, setTip] = useState(() => (refill ? amountText(refill.tipCents) : ""));
  // Credit first while the guest holds some here; else the card.
  const [billWith, setBillWith] = useState<BillWith>(() => (!place.card_ok || place.available_cents > 0 ? "credit" : "card"));
  const [ticket, setTicket] = useState(() => refill?.ticket ?? "");
  const [cancelNote, setCancelNote] = useState(refill !== null);
  const [creditChanged, setCreditChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState<string | null>(null);
  const attempt = useRef<PayAttempt | null>(null);
  // The waiter's charge (MESITA-3306): no code field until the guest asks
  // for it; a right code sets the amount and the ticket, read-only.
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [charge, setCharge] = useState<WaiterCharge | null>(null);
  const [looking, setLooking] = useState(false);

  const at = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;
  const cents = charge ? charge.amount_cents : readAmount(amount);
  // A percent button is a share of the bill the guest picked, worked out
  // here; the server checks the card + tip it is sent.
  const tipTyped = !place.card_ok
    ? 0
    : typeof tipChoice === "number"
    ? cents === null ? 0 : Math.round((cents * tipChoice) / 100)
    : tipChoice === "other"
    ? readTip(tip)
    : 0;
  const tipBad = tipChoice === "other" && tip.trim() !== "" && tipTyped === null;
  const tipCents = tipTyped ?? 0;
  const split = cents === null || cents <= 0
    ? null
    : paySplit({
      amountCents: cents,
      tipCents,
      // "Card" is a card part of the whole bill: no credit used.
      availableCents: billWith === "credit" ? place.available_cents : 0,
      cardOk: place.card_ok,
      minCents: place.card_min_cents,
    });
  const card = split?.kind === "card" ? split : null;
  const total = card ? card.credit_cents + card.card_cents + card.tip_cents : (cents ?? 0);
  const earn = card ? cashbackFor(card.card_cents, place.cashback_bps) : 0;
  const m = (c: number) => money(c, place.currency);

  const amountBad = amount.trim() !== "" && cents === null;
  const reason = at === "bill"
    ? amountBad ? "Type an amount like 250 or 250.50" : null
    : at === "tip"
    ? tipBad ? "Type a tip like 30 or 30.50" : null
    : split?.kind === "over"
    ? `More than your ${m(place.available_cents)} of credit here`
    : split?.kind === "below_minimum"
    ? `Card payments start at ${m(split.minimum_cents)}`
    : null;
  const canPay = split !== null && (split.kind === "credit" || split.kind === "card") && !tipBad && !busy && !looking;
  const canNext = at === "bill"
    ? cents !== null && cents > 0 && !looking
    : at === "tip"
    ? tipChoice !== null && (tipChoice !== "other" || tipTyped !== null)
    : canPay;

  /** A refusal of the waiter's code: true when handled here. */
  function chargeRefused(e: EFError): boolean {
    const body = e.body ?? {};
    if (e.code === "taken" && typeof body.payment_id === "string") {
      onTaken(body.payment_id);
      return true;
    }
    if (e.code === "locked" && typeof body.retry_after_s === "number") {
      toast(`${CHARGE_REFUSAL.locked} Try again in ${Math.ceil(body.retry_after_s / 60)} min.`, { tone: "error" });
      return true;
    }
    if (e.code === "gone" || e.code === "taken") {
      toast(CHARGE_REFUSAL[e.code], { tone: "error" });
      setCharge(null);
      setCode("");
      return true;
    }
    return false;
  }

  async function look(typed: string) {
    setLooking(true);
    try {
      const c = await apiLookCharge(getSupabase(), place.place_id, typed);
      attempt.current = null;
      setCharge(c);
      setAmount(amountText(c.amount_cents));
      setCreditChanged(false);
    } catch (e) {
      if (!(e instanceof EFError) || !e.code || !chargeRefused(e)) {
        toast(e instanceof EFError && e.code ? PAY_REFUSAL[e.code] ?? e.message : NETWORK_FAILURE, { tone: "error" });
      }
    } finally {
      setLooking(false);
    }
  }

  async function pay() {
    if (!split || !canPay || cents === null) return;
    const a = attemptFor(attempt.current, place.place_id, total);
    attempt.current = a;
    setBusy(true);
    setResume(null);
    setCancelNote(false);
    try {
      const started = await apiStartPayment(getSupabase(), {
        place_id: place.place_id,
        place_name: place.name,
        place_marks: place.marks,
        amount_cents: cents,
        ...(card ? { card_cents: card.card_cents, tip_cents: card.tip_cents, return_url: `${window.location.origin}${CONSUMER_ROUTES.pay}` } : {}),
        request_id: a.requestId,
        ticket: charge ? charge.ticket : ticket.trim() || null,
        ...(charge ? { charge_code: code } : {}),
      });
      attempt.current = null;
      if (started.kind === "checkout") {
        // The card part: Stripe's page; its Back lands on the receipt.
        replaceAddress(payReceiptPath(started.payment_id));
        window.location.assign(started.url);
        return;
      }
      if (started.kind === "already_paid") {
        onTaken(started.payment_id);
        return;
      }
      onPaid(started.proof);
    } catch (e) {
      if (!(e instanceof EFError) || !e.code) {
        // No verdict: the payment may have gone through. Keep the id, so
        // the next tap replays to it instead of paying twice.
        toast(NETWORK_FAILURE, { tone: "error" });
        return;
      }
      attempt.current = null;
      const body = e.body ?? {};
      if (charge && chargeRefused(e)) return;
      if (e.code === "taken" && typeof body.payment_id === "string") {
        onTaken(body.payment_id);
        return;
      }
      if (e.code === "insufficient" || e.code === "below_minimum") {
        // The credit moved under the form: re-read, and back to "Pay the
        // bill with" with the new split.
        setCreditChanged(true);
        setStep(steps.indexOf("billWith"));
        onRefresh();
        return;
      }
      if (e.code === "in_progress") {
        // A Checkout of this guest here is still open: resume it, never
        // a second one behind it.
        if (typeof body.url === "string") setResume(body.url);
        else if (typeof body.payment_id === "string") onTaken(body.payment_id);
        toast(PAY_REFUSAL.in_progress, { tone: "error" });
        return;
      }
      if (e.code === "locked" && typeof body.retry_after_s === "number") {
        toast(`${PAY_REFUSAL.locked} Try again in ${Math.ceil(body.retry_after_s / 60)} min.`, { tone: "error" });
        return;
      }
      toast(PAY_REFUSAL[e.code] ?? e.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const payLabel = !split || cents === null
    ? "Pay"
    : card
    ? `Go to checkout · ${m(total)}`
    : `Pay ${m(cents)} with credit`;
  const title = at === "billWith" && cents !== null
    ? `Pay the ${m(cents)} bill with`
    : at === "tipWith" && tipCents > 0
    ? `Pay the ${m(tipCents)} tip with`
    : at === "tipWith"
    ? "Check and pay"
    : STEP_TITLE[at];

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-pay-sheet>
      <div className="flex items-center justify-between px-2 pt-1">
        <button
          type="button"
          aria-label={step > 0 ? "Back" : "Back to places"}
          onClick={() => (step > 0 ? setStep(step - 1) : onBack())}
          className="hover:bg-muted flex h-11 w-11 items-center justify-center rounded-full"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-muted-foreground text-sm font-medium">
          Step {step + 1} of {steps.length}
        </span>
        <button type="button" aria-label="Close" onClick={onBack} className="hover:bg-muted flex h-11 w-11 items-center justify-center rounded-full">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="mt-2 grid gap-1.5 px-4" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-hidden>
        {steps.map((s, i) => (
          <span key={s} className={cn("h-1 rounded-full", i <= step ? "bg-foreground" : "bg-border")} />
        ))}
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <div className="flex items-center gap-3">
          <PlacePhoto place={place} className="h-11 w-11" />
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold">{place.name ?? "A Mesita place"}</span>
            {place.address ? <span className="text-muted-foreground mt-0.5 block truncate text-sm">{place.address}</span> : null}
          </span>
        </div>
        {cancelNote ? (
          <p className="text-muted-foreground mt-3 text-sm" role="status">
            Payment cancelled
          </p>
        ) : null}

        <h2 className={cn("mt-6 text-xl font-semibold", (at === "bill" || at === "tip") && "text-center")}>{title}</h2>

        {at === "bill" ? (
          <>
            <p className="text-muted-foreground mt-1 text-center text-sm">The total on your check, before tip</p>
            <label className="border-foreground mx-auto mt-6 flex w-60 items-baseline justify-center gap-1.5 border-b-2 pb-2" htmlFor="pay-amount">
              <span className="text-muted-foreground text-4xl font-semibold">$</span>
              <input
                id="pay-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                readOnly={charge !== null}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setCreditChanged(false);
                }}
                className="placeholder:text-muted-foreground/50 w-36 min-w-0 bg-transparent text-4xl font-semibold tabular-nums outline-none"
                aria-label="Bill amount"
              />
              <span className="text-muted-foreground text-base font-semibold">{place.currency.toUpperCase()}</span>
            </label>
            {charge ? (
              <p className="text-muted-foreground mt-3 text-center text-sm" data-waiter-charge>
                The waiter&apos;s charge{charge.ticket ? ` · Ticket ${charge.ticket}` : ""} ·{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setCharge(null);
                    setCode("");
                    setAmount("");
                    attempt.current = null;
                  }}
                >
                  Not this code
                </button>
              </p>
            ) : null}

            {charge ? null : (
              <>
                <label className="mt-8 block text-sm font-semibold" htmlFor="pay-ticket">
                  Check or table no. <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="pay-ticket"
                  autoComplete="off"
                  maxLength={32}
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  className={cn(FIELD_CLASS, "mt-1.5")}
                />
                {codeOpen ? (
                  <>
                    <label className="mt-4 block text-sm font-semibold" htmlFor="pay-charge-code">
                      Waiter&apos;s code
                    </label>
                    <input
                      id="pay-charge-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={4}
                      placeholder="0000"
                      value={code}
                      disabled={looking}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setCode(v);
                        if (v.length === 4) void look(v);
                      }}
                      className={cn(FIELD_CLASS, "mt-1.5 tracking-[0.3em] tabular-nums")}
                    />
                  </>
                ) : (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground mt-3 flex min-h-11 items-center text-sm font-semibold underline"
                    onClick={() => setCodeOpen(true)}
                    data-charge-code-link
                  >
                    Waiter gave you a code?
                  </button>
                )}
              </>
            )}
          </>
        ) : null}

        {at === "tip" ? (
          <>
            <p className="text-muted-foreground mt-1 text-center text-sm">It all goes to the staff, by card</p>
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              {TIP_PERCENTS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  aria-pressed={tipChoice === pct}
                  onClick={() => setTipChoice(pct)}
                  className={cn(
                    "flex h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border transition",
                    tipChoice === pct ? "border-foreground bg-muted/60 border-2" : "border-border hover:bg-muted/60",
                  )}
                >
                  <span className="text-base font-semibold">{pct}%</span>
                  <span className="text-muted-foreground text-sm tabular-nums">{cents !== null ? m(Math.round((cents * pct) / 100)) : ""}</span>
                </button>
              ))}
              <button
                type="button"
                aria-pressed={tipChoice === "other"}
                onClick={() => setTipChoice("other")}
                className={cn(
                  "flex h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border transition",
                  tipChoice === "other" ? "border-foreground bg-muted/60 border-2" : "border-border hover:bg-muted/60",
                )}
              >
                <span className="text-base font-semibold">Other</span>
                <span className="text-muted-foreground text-sm">Type it</span>
              </button>
            </div>
            {tipChoice === "other" ? (
              <input
                id="pay-tip"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                placeholder="Tip"
                aria-label="Tip"
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                className={cn(FIELD_CLASS, "mt-3 tabular-nums")}
              />
            ) : null}
          </>
        ) : null}

        {at === "billWith" ? (
          <>
            {creditChanged ? (
              <p className="mt-2 text-sm font-semibold" role="status">
                Your credit changed
              </p>
            ) : null}
            <div className="border-border mt-4 overflow-hidden rounded-2xl border" role="radiogroup" aria-label="Pay the bill with">
              <MethodRow
                name="pay-bill-with"
                icon={CreditCard}
                title="Card"
                note={
                  !place.card_ok
                    ? "This place takes credit only"
                    : place.cashback_bps > 0
                    ? `Card, Apple Pay or Google Pay · ${place.cashback_bps / 100}% back as credit here`
                    : "Card, Apple Pay or Google Pay"
                }
                checked={billWith === "card"}
                disabled={!place.card_ok}
                onPick={() => setBillWith("card")}
              />
              <div className="bg-border h-px" />
              <MethodRow
                name="pay-bill-with"
                icon={WalletIcon}
                title={`Credit at ${place.name ?? "this place"}`}
                note={`You have ${m(place.available_cents)} here${place.pending_cents > 0 ? ` · ${m(place.pending_cents)} pending` : ""}`}
                checked={billWith === "credit"}
                disabled={place.available_cents <= 0}
                onPick={() => setBillWith("credit")}
              />
            </div>
            {place.card_ok && billWith === "credit" ? (
              <p className="text-muted-foreground mt-3 px-1 text-sm">Your credit pays first and the card pays the rest.</p>
            ) : null}
          </>
        ) : null}

        {at === "tipWith" && tipCents > 0 ? (
          <div className="border-border mt-4 overflow-hidden rounded-2xl border" role="radiogroup" aria-label="Pay the tip with">
            <MethodRow name="pay-tip-with" icon={CreditCard} title="Card" note="The same card as the bill" checked disabled={false} onPick={() => {}} />
            <div className="bg-border h-px" />
            <MethodRow name="pay-tip-with" icon={WalletIcon} title="Credit" note="Tips go by card" checked={false} disabled onPick={() => {}} />
          </div>
        ) : null}

        {last && split && (split.kind === "credit" || split.kind === "card") ? (
          <div className="bg-muted/60 mt-4 flex flex-col gap-2 rounded-2xl px-4 py-3.5 text-sm tabular-nums" data-pay-split>
            {split.credit_cents > 0 ? (
              <p className="flex justify-between"><span>Bill · credit</span><span>{m(split.credit_cents)}</span></p>
            ) : null}
            {split.card_cents > 0 ? (
              <p className="flex justify-between"><span>Bill · card</span><span>{m(split.card_cents)}</span></p>
            ) : null}
            {split.tip_cents > 0 ? (
              <p className="flex justify-between"><span>Tip · card</span><span>{m(split.tip_cents)}</span></p>
            ) : null}
            {card?.raised ? (
              <p className="text-muted-foreground">Card minimum {m(place.card_min_cents)}: a little less credit is used</p>
            ) : null}
            <div className="bg-border h-px" />
            <p className="flex justify-between text-base font-semibold"><span>Total</span><span>{m(total)}</span></p>
            {earn > 0 ? (
              <p className="text-muted-foreground flex justify-between"><span>You get back as credit here</span><span>{m(earn)}</span></p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-border border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {last ? (
          <Button size="lg" className="w-full text-base font-semibold" disabled={!canPay} onClick={() => void pay()}>
            {busy ? <Spinner size="sm" label="Paying" /> : payLabel}
          </Button>
        ) : (
          <Button size="lg" className="w-full text-base font-semibold" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Next
          </Button>
        )}
        {reason && !busy ? <p className="text-muted-foreground mt-2 text-center text-xs">{reason}</p> : null}
        {last && card ? <p className="text-muted-foreground mt-2 text-center text-xs">You pay on Stripe&apos;s secure page</p> : null}
        {resume ? (
          <button type="button" className={cn(QUIET_BUTTON_CLASS, "mt-3")} onClick={() => window.location.assign(resume)}>
            Resume card payment
          </button>
        ) : null}
      </div>
    </div>
  );
}
