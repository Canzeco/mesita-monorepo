"use client";

import { useEffect, useState } from "react";
import { clockTime, moneyLabel } from "@mesita/place-profile/lib/money";
import { payChecklist, verifyLabel } from "@mesita/place-profile/lib/pay-checklist";
import { payStepLabel, SIGN } from "@mesita/place-profile/lib/pay-steps";
import { listPayments, type TabRead, type TabRefusal, verifyTab } from "@/lib/visit-api";
import { type CashAnswer, signRequest } from "@/lib/sign-gate";

// The waiter's side of a guest's payment (MESITA-3708). The guest typed the
// amount, chose how to pay and paid; the waiter scanned their QR and lands
// here, on any phone, with nothing to type first (MESITA-3799). Top to
// bottom: the heading "Sign" (MESITA-3759: no number, no segments), the
// ticket number when the payment carries one (MESITA-3796: only
// waiter-billed tabs do), the amount before tip, the tip, the same checklist
// the guest sees, one action line, the live clock, then the signature: when
// cash is owed one yes/no question ("Did you get X in cash?", never a typed
// amount; No never signs), the waiter code, and one button that names the
// action. The code is typed for every signature: Sign trades it for a staff
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

  return (
    <main className="proof" data-tab-state="verify">
      {band}
      {reconnecting}
      <h1>{payStepLabel("sign", "waiter")}</h1>
      {/* The ticket first, at the amount's size, only when the payment
          carries one (a waiter-billed tab; MESITA-3776, MESITA-3796). */}
      {tab.ticket ? (
        <p className="verify-ticket" data-verify-ticket>
          {`Ticket ${tab.ticket}`}
        </p>
      ) : null}
      <p className="verify-amount" aria-label={`Amount before tip ${money(tab.bill_cents ?? 0)}`}>
        {money(tab.bill_cents ?? 0)}
      </p>
      <p className="proof-line">{tip > 0 ? `+ ${money(tip)} tip` : "No tip"}</p>
      <ol className="checklist" aria-label="Payment">
        {steps.map((s) => (
          <li key={s.key} data-state={s.state}>
            <span className="checklist-mark" aria-hidden>{s.state === "done" ? "✓" : s.state === "failed" ? "×" : "○"}</span>
            <span className="checklist-label">
              {s.label}
              {s.note ? <span className="checklist-note">{s.note}</span> : null}
            </span>
            {s.cents !== null ? <span className="checklist-cents">{money(s.cents)}</span> : null}
          </li>
        ))}
      </ol>
      <p className="proof-status" role="status">
        {owed > 0 ? `Collect ${money(owed)} in cash` : tab.card_pending ? "Card still going through" : "Nothing to collect · paid in the app"}
      </p>
      <p className="proof-line proof-clock" aria-hidden>
        {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sign();
        }}
        style={{ alignSelf: "stretch" }}
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
            {cashAnswer === "no" ? (
              <p className="proof-status warn" role="alert">
                {SIGN.cashNotReceived}
              </p>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className="proof-status warn" role="alert" aria-live="polite">
            {error}
          </p>
        ) : null}
        <p>{SIGN.meaning}</p>
        <label className="field">
          {SIGN.waiterCode}
          <input className="secret" inputMode="numeric" autoComplete="off" maxLength={7} value={typedCode} onChange={(e) => setTypedCode(e.target.value)} />
        </label>
        <button type="submit" disabled={busy || !request} style={{ minHeight: 56 }}>
          {busy ? SIGN.signing : verifyLabel({ cashBillCents: owed, cashTipCents: 0 }, money)}
        </button>
      </form>
      <p className="proof-place">{tab.place.name ?? "A Mesita place"}</p>
    </main>
  );
}
