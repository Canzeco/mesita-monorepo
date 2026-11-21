"use client";

import { useState } from "react";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { SIGN } from "@mesita/place-profile/lib/pay-steps";
import { listPayments, rejectTab, type TabRead, type TabRefusal, verifyTab } from "@/lib/visit-api";
import { signRequest } from "@/lib/sign-gate";
import { CodeBoxes } from "./CodeBoxes";
import { BanknoteIcon, CheckIcon, HandCoinsIcon, SmartphoneIcon, UserIcon, WalletIcon, XIcon } from "./icons";

// THE WAITER'S SCREEN (MESITA-3857, Pato's "14. Payments Flow Guest-Lead"
// §5): the waiter scans the guest's QR and checks the bill against the real
// one. Top to bottom: the guest's photo (a person glyph when there is none;
// never a name), the total in large type, the lines with the guest's icons
// (Wallet credits; Smartphone "by card" or Banknote "cash received";
// HandCoins tip), the 4-digit waiter code (MESITA-4521, Pato: "To avoid
// trolls, use mesita code to accept payments"), the dark "Confirm · final"
// with a Check, and the red "Reject" with an X, as tall as Confirm
// (MESITA-4108, Pato: "reject button must be red same height as black").
// Confirm is the cash's confirmation: no yes/no question. Confirm and Reject
// trade the code for a staff token for this one tap; neither is kept. Then: Receipt (green),
// Confirming (the card is being charged), Not charged (the charge failed;
// it says to ask the guest to pay again, MESITA-4305),
// or "This bill is no longer open" with why.

function vibrate() {
  try {
    navigator.vibrate?.(120);
  } catch {
    // The green screen says it anyway.
  }
}

const NO_LONGER_OPEN: Record<string, string> = {
  cancelled: "Cancelled by the guest.",
  rejected: "Rejected.",
  expired: "Expired.",
};

export function GuestVerify({ token, tab, band, reconnecting, onChanged }: {
  token: string;
  tab: TabRead;
  band: React.ReactNode;
  reconnecting: React.ReactNode;
  onChanged: () => Promise<void>;
}) {
  const [typedCode, setTypedCode] = useState("");
  const [busy, setBusy] = useState<"sign" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mine, setMine] = useState<{ at: string; again: boolean } | null>(null);

  const placeId = tab.place.id;
  const money = (c: number) => moneyLabel(c, tab.currency);
  const card = tab.card_bill_cents + tab.card_tip_cents;
  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const tip = tab.card_tip_cents + tab.cash_tip_cents;
  const total = tab.credit_cents + card + cash;
  const verifiedAt = mine?.at ?? tab.verified_at ?? null;
  const ended = tab.status === "expired" || tab.status === "cancelled";
  // Confirm confirms the cash: what is owed is what was received.
  const request = signRequest({ owedCents: cash, cashAnswer: cash > 0 ? "yes" : null, typedCode, cardPending: tab.card_pending === true });
  const placeName = tab.place.name ?? "A Mesita place";

  function refused(r: TabRefusal) {
    if (r.code === "staff_code_needed") return setError(SIGN.wrongWaiterCode);
    if (r.code === "card_pending") return setError("The guest's card is still going through.");
    if (r.code === "forbidden") return setError("This bill is for another place.");
    if (r.code === "gone") return setError("Scan the guest's screen again.");
    setError(r.error);
  }

  /** The waiter code buys a staff token for this one tap; null on refusal. */
  async function staffToken(): Promise<string | null> {
    if (!request) return null;
    const key = await listPayments({ place_id: placeId, place_code: request.place_code });
    setTypedCode("");
    if (key === "failed") {
      setError(SIGN.tapSignAgain);
      return null;
    }
    if ("kind" in key) {
      const wait = key.retryAfterS ? ` ${SIGN.tryAgainInMin(Math.ceil(key.retryAfterS / 60))}` : "";
      setError(key.kind === "staff_only" ? SIGN.wrongWaiterCode : `${key.error}${wait}`);
      return null;
    }
    if (!key.staff_token) setError(SIGN.couldntSign);
    return key.staff_token ?? null;
  }

  async function sign() {
    if (busy || !request) return;
    setBusy("sign");
    setError(null);
    try {
      const staff = await staffToken();
      if (!staff) return;
      const r = await verifyTab({ token, place_id: placeId, staff_token: staff, cash_received_cents: request.cash_received_cents });
      if (r === "failed") return setError(SIGN.tapSignAgain);
      if ("refused" in r) {
        refused(r);
        await onChanged();
        return;
      }
      if (r.outcome === "confirming") {
        setConfirming(true);
        await onChanged();
        return;
      }
      setMine({ at: r.verified_at ?? new Date().toISOString(), again: r.outcome === "already_verified" });
      if (r.outcome === "verified") vibrate();
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (busy || !request) return;
    setBusy("reject");
    setError(null);
    try {
      const staff = await staffToken();
      if (!staff) return;
      const r = await rejectTab({ token, place_id: placeId, staff_token: staff });
      if (r === "failed") return setError("Couldn't reject. Tap again.");
      if ("refused" in r) refused(r);
      setRejecting(false);
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  // RECEIPT: green.
  if (verifiedAt) {
    return (
      <main className="tab-paid" data-tab-state={mine?.again ? "already-verified" : "verified"}>
        {band}
        <span className="tab-paid-tick" aria-hidden>
          <CheckIcon className="pay-icon-xl" />
        </span>
        <p className="tab-paid-title" role="status">
          {/* No time once confirmed (MESITA-4133). */}
          {mine?.again ? "Already confirmed" : "Confirmed"}
        </p>
        <p className="tab-paid-amount">{money(total)}</p>
        {tip > 0 ? <p className="tab-paid-line">Includes {money(tip)} tip</p> : null}
        <p className="tab-paid-line">{placeName}</p>
      </main>
    );
  }

  // NOT CHARGED: the card charge failed at Confirm.
  if (ended && tab.end_reason === "capture_failed") {
    return (
      <main className="proof pay-end" data-tab-state="not-charged">
        {band}
        <span className="pay-end-mark pay-bad" aria-hidden>
          <XIcon className="pay-icon-xl" />
        </span>
        <h1>Not charged</h1>
        <p className="proof-line">The card charge failed. Nothing was charged.</p>
        {/* MESITA-4305: the next step. The guest's Start again reopens Pay
            with the same bill; their new QR comes back here to Confirm. */}
        <p className="proof-line">Ask the guest to pay again with another card or cash. Then scan their new QR.</p>
        <p className="proof-place">{placeName}</p>
      </main>
    );
  }

  // NO LONGER OPEN.
  if (ended) {
    const why = NO_LONGER_OPEN[tab.end_reason ?? ""] ?? (tab.status === "expired" ? NO_LONGER_OPEN.expired : NO_LONGER_OPEN.cancelled);
    return (
      <main className="proof pay-end" data-tab-state={tab.status}>
        {band}
        <span className="pay-end-mark" aria-hidden>
          <XIcon className="pay-icon-xl" />
        </span>
        <h1>This bill is no longer open</h1>
        <p className="proof-line">{why}</p>
        <p className="proof-place">{placeName}</p>
      </main>
    );
  }

  // CONFIRMING: the card is being charged.
  if (confirming || tab.signing === true) {
    return (
      <main className="proof pay-end" data-tab-state="confirming">
        {band}
        {reconnecting}
        <span className="pay-spinner" aria-hidden />
        <h1 role="status">Confirming…</h1>
        <p className="proof-place">{placeName}</p>
      </main>
    );
  }

  // TO CONFIRM.
  // Each line: the word on the left, the amount on the right (MESITA-4108).
  const lines: Array<{ key: string; icon: React.ReactNode; label: string; value: string; good?: boolean }> = [];
  if (tab.credit_cents > 0) lines.push({ key: "credit", icon: <WalletIcon className="pay-icon" />, label: "Credits", value: money(tab.credit_cents) });
  if (card > 0) lines.push({ key: "card", icon: <SmartphoneIcon className="pay-icon" />, label: "By card", value: money(tab.card_bill_cents) });
  if (cash > 0) lines.push({ key: "cash", icon: <BanknoteIcon className="pay-icon" />, label: "Cash received", value: money(tab.cash_bill_cents) });
  if (tip > 0) lines.push({ key: "tip", icon: <HandCoinsIcon className="pay-icon" />, label: "Tip", value: money(tip) });

  return (
    <main className="proof verify" data-tab-state="verify">
      {band}
      {reconnecting}
      {/* MODULAR, IN BOXES (MESITA-4108, Pato: "make a cleaner design ...
          modular in boxes. optimize vertical space"): box one is the bill
          (who, where, total, then each line word-left amount-right); box two
          is the waiter code and its pad; then Reject and Confirm. */}
      <section className="verify-box" aria-label="The guest's bill">
      <div className="pay-guest">
        <span className="pay-guest-photo" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {tab.guest_photo ? <img src={tab.guest_photo} alt="" /> : <UserIcon className="pay-icon" />}
        </span>
        <span className="pay-guest-text">
          <span className="pay-guest-title">Guest&apos;s bill</span>
          <span className="pay-guest-place">{placeName}</span>
        </span>
        {/* The total on the row's right (MESITA-4103, Pato: "optimize a lot
            the vertical space in the visit subdomain"). */}
        <p className="verify-amount" aria-label={`Total ${money(total)}`}>
          {money(total)}
        </p>
      </div>
      <ul className="pay-lines" aria-label="How the guest pays">
        {lines.map((l) => (
          <li key={l.key} data-pay-line={l.key} className={l.good ? "pay-line-good" : undefined}>
            {l.icon}
            <span className="pay-line-label">{l.label}</span>
            <span className="pay-line-value">{l.value}</span>
          </li>
        ))}
      </ul>
      </section>
      <form
        className="verify-form"
        onSubmit={(e) => {
          e.preventDefault();
          void sign();
        }}
      >
        <CodeBoxes value={typedCode} onChange={setTypedCode} />
        {error ? (
          <p className="proof-status warn" role="alert" aria-live="polite">
            {error}
          </p>
        ) : null}
        {rejecting ? (
          <div className="pay-reject-confirm" role="group" aria-label="Reject this bill?">
            <p className="proof-line pay-reject-title">Reject this bill?</p>
            {/* What rejecting does to the money (MESITA-4105, Pato: "if cash
                mention to return money ... if digital, say you already
                received the payment"). */}
            {cash > 0 ? (
              <p className="pay-final-line">Give the guest back the {money(cash)} cash.</p>
            ) : null}
            {tab.credit_cents + card > 0 ? (
              <p className="pay-final-line">
                The guest already paid {money(tab.credit_cents + card)} with Mesita. Rejecting returns it to them
                .
              </p>
            ) : null}
            <div className="yes-no">
              <button type="button" className="verify-reject" disabled={!!busy || !request} onClick={() => void reject()}>
                {busy === "reject" ? "Rejecting…" : "Yes, reject"}
              </button>
              <button type="button" className="quiet" onClick={() => setRejecting(false)}>
                No
              </button>
            </div>
          </div>
        ) : (
          // One row: Reject a third, Confirm two thirds. "Confirm · final"
          // says it can't be undone; the pad says a code is needed.
          <div className="verify-actions">
            <button type="button" className="verify-reject pay-with-icon" disabled={!!busy || !request} onClick={() => setRejecting(true)}>
              <XIcon className="pay-icon" />
              Reject
            </button>
            <button type="submit" className="verify-sign pay-with-icon" disabled={!!busy || !request}>
              {busy === "sign" ? SIGN.signing : (
                <>
                  <CheckIcon className="pay-icon" />
                  Confirm · final
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </main>
  );
}
