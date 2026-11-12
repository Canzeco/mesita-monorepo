"use client";

import { useEffect, useState } from "react";
import { clockTime, moneyLabel } from "@mesita/place-profile/lib/money";
import { type ChecklistStep, payChecklist, verifyLabel } from "@mesita/place-profile/lib/pay-checklist";
import { payStepLabel, SIGN } from "@mesita/place-profile/lib/pay-steps";
import { listPayments, type TabRead, type TabRefusal, verifyTab } from "@/lib/visit-api";
import { type CashAnswer, signRequest } from "@/lib/sign-gate";
import { CodeBoxes } from "./CodeBoxes";

// The waiter's side of a guest's payment (MESITA-3708). The guest typed the
// amount, chose how to pay and paid; the waiter scanned their QR and lands
// here, on any phone, with nothing to type first (MESITA-3799). One screen,
// no scroll on a 375x667 phone (MESITA-3818). Top to bottom: "Sign" with the
// live clock beside it, the ticket when the payment carries one (MESITA-3796:
// only waiter-billed tabs do), the amount before tip, the tip, one line of
// how it was paid (the guest's checklist, compacted), then the signature:
// when cash is owed one yes/no question ("Did you get X in cash?", never a
// typed amount; No never signs), the waiter code in six boxes, and one
// button that names the action. The code is typed for every signature: Sign trades it for a staff
// token and signs with that; this page keeps neither the code nor the token
// (MESITA-3734: there is no Staff QR). Labels say "Sign"; names in code and
// on the wire keep "verify".

/** A live clock: a screenshot of this page is visibly stale. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** The checklist's ways to pay on one line: "Card MX$300.00 ✓ · Cash
 *  MX$200.00 to collect". Amount and tip have their own lines; "Waiter
 *  signed" is the button. */
function partsLine(steps: ChecklistStep[], money: (c: number) => string): string {
  return steps
    .filter((s) => s.key === "credit" || s.key === "card" || s.key === "cash")
    .map((s) => {
      const cents = money(s.cents ?? 0);
      if (s.key === "card" && s.state === "waiting") return "Card still going through";
      if (s.key === "cash" && s.state !== "done") return `Cash ${cents} to collect`;
      return s.state === "done" ? `${s.label} ${cents} ✓` : `${s.label} ${cents}`;
    })
    // A part never breaks across lines; the line wraps between parts.
    .map((part) => part.replace(/ /g, " "))
    .join(" · ");
}

function vibrate() {
  try {
    navigator.vibrate?.(120);
  } catch {
    // Not every browser can; the green screen says it anyway.
  }
}

export function GuestVerify({ token, tab, band, reconnecting, onChanged }: {
  token: string;
  tab: TabRead;
  band: React.ReactNode;
  reconnecting: React.ReactNode;
  onChanged: () => Promise<void>;
}) {
  const now = useNow();
  const [cashAnswer, setCashAnswer] = useState<CashAnswer>(null);
  const [typedCode, setTypedCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // This phone's own verify, so "already verified" can tell this phone from another.
  const [mine, setMine] = useState<{ at: string; outcome: "verified" | "already_verified"; samePhone: boolean | null } | null>(null);

  const placeId = tab.place.id;
  const money = (c: number) => moneyLabel(c, tab.currency);
  const owed = tab.cash_bill_cents + tab.cash_tip_cents;
  const tip = tab.cash_tip_cents + tab.card_tip_cents;
  const closed = tab.status === "expired" || tab.status === "cancelled";
  const verifiedAt = mine?.at ?? tab.verified_at ?? null;
  const request = signRequest({ owedCents: owed, cashAnswer, typedCode, cardPending: tab.card_pending === true });

  const steps = payChecklist({
    billCents: tab.bill_cents ?? 0,
    creditCents: tab.credit_cents,
    cardBillCents: tab.card_bill_cents,
    cardTipCents: tab.card_tip_cents,
    cashBillCents: tab.cash_bill_cents,
    cashTipCents: tab.cash_tip_cents,
    cardPending: tab.card_pending === true,
    paid: tab.status === "paid",
    verifiedAt,
    closed,
    side: "waiter",
  });

  function refused(r: TabRefusal) {
    if (r.code === "staff_code_needed") return setError(SIGN.wrongWaiterCode);
    if (r.code === "card_pending") return setError("Card still going through");
    if (r.code === "expired") return setError(`This payment closed at ${clockTime(tab.expires_at)}.`);
    if (r.code === "forbidden") return setError("This payment is for another place.");
    if (r.code === "gone") return setError("Scan the guest's screen again.");
    setError(r.error);
  }

  // Sign: the waiter code buys a staff token for this one signature, then
  // the token signs. Neither is kept; the code clears once the server answered.
  async function sign() {
    if (busy || !request) return;
    setBusy(true);
    setError(null);
    try {
      const key = await listPayments({ place_id: placeId, place_code: request.place_code });
      if (key === "failed") return setError(SIGN.tapSignAgain);
      if ("kind" in key) {
        setTypedCode("");
        const wait = key.retryAfterS ? ` ${SIGN.tryAgainInMin(Math.ceil(key.retryAfterS / 60))}` : "";
        return setError(key.kind === "staff_only" ? SIGN.wrongWaiterCode : `${key.error}${wait}`);
      }
      if (!key.staff_token) {
        setTypedCode("");
        return setError(SIGN.couldntSign);
      }
      const r = await verifyTab({ token, place_id: placeId, staff_token: key.staff_token, cash_received_cents: request.cash_received_cents });
      if (r === "failed") return setError(SIGN.tapSignAgain);
      setTypedCode("");
      if ("refused" in r) {
        refused(r);
        if (r.code === "card_pending") setTimeout(() => void onChanged(), 2000);
        else await onChanged();
        return;
      }
      setMine({ at: r.verified_at ?? new Date().toISOString(), outcome: r.outcome, samePhone: r.outcome === "verified" ? true : r.same_phone });
      if (r.outcome === "verified") vibrate();
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  // Verified: green; by this phone earlier: the warning tone; by another
  // phone: red, which outranks green.
  if (verifiedAt) {
    const another = mine ? mine.samePhone === false : null;
    if (another) {
      return (
        <main className="tab-paid tab-paid-alert" data-tab-state="verified-elsewhere" role="alert">
          {band}
          <span className="tab-paid-tick" aria-hidden>!</span>
          <p className="tab-paid-title">{SIGN.signedElsewhereAt(clockTime(verifiedAt))}</p>
          <p className="tab-paid-amount">{money(tab.bill_cents ?? 0)}</p>
          <p className="tab-paid-line">Check with your team before the guest leaves.</p>
          <p className="tab-paid-line">{tab.place.name ?? "A Mesita place"}</p>
        </main>
      );
    }
    const again = mine?.outcome === "already_verified";
    return (
      <main className={again ? "tab-paid tab-paid-notice" : "tab-paid"} data-tab-state={again ? "already-verified" : "verified"}>
        {band}
        <span className="tab-paid-tick" aria-hidden>✓</span>
        <p className="tab-paid-title" role="status">
          {again ? SIGN.alreadySignedAt(clockTime(verifiedAt)) : SIGN.signedAt(clockTime(verifiedAt))}
        </p>
        <p className="tab-paid-amount">{money(tab.bill_cents ?? 0)}</p>
        {tip > 0 ? <p className="tab-paid-line">+ {money(tip)} tip</p> : null}
        <p className="tab-paid-line">{tab.place.name ?? "A Mesita place"}</p>
      </main>
    );
  }

  if (closed) {
    return (
      <main className="proof" data-tab-state={tab.status}>
        {band}
        <p className="proof-status warn" role="alert">
          {tab.status === "cancelled" ? "The guest cancelled this payment." : `This payment closed at ${clockTime(tab.expires_at)}.`}
        </p>
        <p className="proof-place">{tab.place.name ?? "A Mesita place"}</p>
      </main>
    );
  }

  const alert = error ?? (cashAnswer === "no" ? SIGN.cashNotReceived : null);
  const parts = partsLine(steps, money);

  return (
    <main className="proof verify" data-tab-state="verify">
      {band}
      {reconnecting}
      <div className="verify-head">
        <h1>{payStepLabel("sign", "waiter")}</h1>
        <span className="verify-clock" aria-hidden>
          {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>
      {/* The ticket only when the payment carries one (a waiter-billed tab;
          MESITA-3776, MESITA-3796). */}
      {tab.ticket ? (
        <p className="verify-ticket" data-verify-ticket>
          {`Ticket ${tab.ticket}`}
        </p>
      ) : null}
      <p className="verify-amount" aria-label={`Amount before tip ${money(tab.bill_cents ?? 0)}`}>
        {money(tab.bill_cents ?? 0)}
      </p>
      <p className="verify-tip">{tip > 0 ? `+ ${money(tip)} tip` : "No tip"}</p>
      {parts ? (
        <p className="verify-parts" role="status">
          {parts}
        </p>
      ) : null}
      <form
        className="verify-form"
        onSubmit={(e) => {
          e.preventDefault();
          void sign();
        }}
      >
        {owed > 0 ? (
          <div className="cash-question" role="group" aria-labelledby="cash-question">
            <p id="cash-question" className="cash-question-label">
              {SIGN.cashQuestion(money(owed))}
            </p>
            <div className="yes-no">
              <button type="button" aria-pressed={cashAnswer === "yes"} onClick={() => setCashAnswer("yes")}>
                {SIGN.cashYes}
              </button>
              <button type="button" aria-pressed={cashAnswer === "no"} onClick={() => setCashAnswer("no")}>
                {SIGN.cashNo}
              </button>
            </div>
          </div>
        ) : null}
        <CodeBoxes value={typedCode} onChange={setTypedCode} />
        {alert ? (
          <p className="proof-status warn" role="alert" aria-live="polite">
            {alert}
          </p>
        ) : null}
        <button type="submit" className="verify-sign" disabled={busy || !request}>
          {busy ? SIGN.signing : verifyLabel({ cashBillCents: owed, cashTipCents: 0 }, money)}
        </button>
      </form>
      <p className="proof-place">{tab.place.name ?? "A Mesita place"}</p>
    </main>
  );
}
