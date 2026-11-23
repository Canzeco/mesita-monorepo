"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Wallet as WalletIcon, X } from "lucide-react";
import { amountText, readAmount } from "@mesita/place-profile/lib/money";
import { Spinner } from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
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
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { FIELD_CLASS, NETWORK_FAILURE, PlacePhoto } from "./pay-common";

// THE PAY FORM (MESITA-3457, the steps MESITA-3536): the older door to pay
// a place, kept behind "Waiter gave you a code?" on the bill at the table
// (MESITA-3564). A sheet over the screen that opened it, one question a
// step: the bill, then "Pay the bill with" (Credit there) and the summary.
// MESITA-4708: credit only. The card part (Stripe Checkout, a tip by card,
// the card minimum) and its cancelled-Checkout refill (MESITA-3458) are gone.
// The server is the last word on every amount.

type Step = "bill" | "billWith";

const STEP_TITLE: Record<Step, string> = {
  bill: "How much is the bill?",
  billWith: "Pay the bill with",
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
  icon: typeof WalletIcon;
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

export function PayForm({
  place,
  onBack,
  onPaid,
  onTaken,
  onRefresh,
}: {
  place: PayPlace;
  onBack: () => void;
  onPaid: (p: PayProof) => void;
  onTaken: (paymentId: string) => void;
  onRefresh: () => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  // The steps (MESITA-3536): the bill, then how to pay it (credit), the
  // summary and the button.
  const steps: Step[] = ["bill", "billWith"];
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState("");
  const [ticket, setTicket] = useState("");
  const [creditChanged, setCreditChanged] = useState(false);
  const [busy, setBusy] = useState(false);
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
  // Credit pays the whole bill or nothing moves.
  const over = cents !== null && cents > place.available_cents;
  const total = cents ?? 0;
  const m = (c: number) => money(c, place.currency);

  const amountBad = amount.trim() !== "" && cents === null;
  const reason = at === "bill"
    ? amountBad ? "Type an amount like 250 or 250.50" : null
    : over
    ? `More than your ${m(place.available_cents)} of credit here`
    : null;
  const canPay = cents !== null && cents > 0 && !over && !busy && !looking;
  const canNext = at === "bill" ? cents !== null && cents > 0 && !looking : canPay;

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
    if (!canPay || cents === null) return;
    const a = attemptFor(attempt.current, place.place_id, total);
    attempt.current = a;
    setBusy(true);
    try {
      const started = await apiStartPayment(getSupabase(), {
        place_id: place.place_id,
        place_name: place.name,
        place_marks: place.marks,
        amount_cents: cents,
        request_id: a.requestId,
        ticket: charge ? charge.ticket : ticket.trim() || null,
        ...(charge ? { charge_code: code } : {}),
      });
      attempt.current = null;
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
      if (e.code === "insufficient") {
        // The credit moved under the form: re-read, and back to "Pay the
        // bill with" with the new split.
        setCreditChanged(true);
        setStep(steps.indexOf("billWith"));
        onRefresh();
        return;
      }
      toast(PAY_REFUSAL[e.code] ?? e.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const payLabel = cents === null || cents <= 0 ? "Pay" : `Pay ${m(cents)} with credit`;
  const title = at === "billWith" && cents !== null ? `Pay the ${m(cents)} bill with` : STEP_TITLE[at];

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
        <span className="text-muted-foreground text-sm font-semibold">
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

      <div className="scrollbar-thin-dark min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <div className="flex items-center gap-3">
          <PlacePhoto place={place} className="h-11 w-11" />
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold">{place.name ?? "A Mesita place"}</span>
            {place.address ? <span className="text-muted-foreground mt-0.5 block truncate text-sm">{place.address}</span> : null}
          </span>
        </div>
        <h2 className={cn("mt-6 text-xl font-semibold", at === "bill" && "text-center")}>{title}</h2>

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
                  placeholder="e.g. 12"
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
                icon={WalletIcon}
                title={`Credit at ${place.name ?? "this place"}`}
                note={`You have ${m(place.available_cents)} here${place.pending_cents > 0 ? ` · ${m(place.pending_cents)} pending` : ""}`}
                checked={place.available_cents > 0}
                disabled={place.available_cents <= 0}
                onPick={() => {}}
              />
            </div>
          </>
        ) : null}

        {last && canPay ? (
          <div className="bg-muted/60 mt-4 flex flex-col gap-2 rounded-2xl px-4 py-3.5 text-sm tabular-nums" data-pay-split>
            <p className="flex justify-between"><span>Bill · credit</span><span>{m(total)}</span></p>
            <div className="bg-border h-px" />
            <p className="flex justify-between text-base font-semibold"><span>Total</span><span>{m(total)}</span></p>
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
      </div>
    </div>
  );
}
