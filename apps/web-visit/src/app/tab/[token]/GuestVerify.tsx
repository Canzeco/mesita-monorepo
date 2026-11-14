"use client";

import { useState } from "react";
import { clockTime, moneyLabel } from "@mesita/place-profile/lib/money";
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
// HandCoins tip), the waiter code (until MESITA-3858 signs waiters in), the
// dark "Sign · final" with a Check and "Check the amount. Signed payments
// can't be undone.", and the light "Reject" with an X. The signature is the
// cash's confirmation: no yes/no question. Sign trades the code for a staff
// token for this one signature; neither is kept. Then: Receipt (green),
// Confirming (the card is being charged), Not charged (the charge failed),
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
  // The signature confirms the cash: what is owed is what was received.
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
      const key = await listPayments({ place_id: placeId, place_code: request.place_code });
      setTypedCode("");
      if (key === "failed") return setError(SIGN.tapSignAgain);
      if ("kind" in key) {
        const wait = key.retryAfterS ? ` ${SIGN.tryAgainInMin(Math.ceil(key.retryAfterS / 60))}` : "";
        return setError(key.kind === "staff_only" ? SIGN.wrongWaiterCode : `${key.error}${wait}`);
      }
      if (!key.staff_token) return setError(SIGN.couldntSign);
      const r = await verifyTab({ token, place_id: placeId, staff_token: key.staff_token, cash_received_cents: request.cash_received_cents });
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
          {mine?.again ? SIGN.alreadySignedAt(clockTime(verifiedAt)) : SIGN.signedAt(clockTime(verifiedAt))}
        </p>
        <p className="tab-paid-amount">{money(total)}</p>
        {tip > 0 ? <p className="tab-paid-line">Includes {money(tip)} tip</p> : null}
        <p className="tab-paid-line">{placeName}</p>
      </main>
    );
  }

  // NOT CHARGED: the card charge failed at the signature.
  if (ended && tab.end_reason === "capture_failed") {
    return (
      <main className="proof pay-end" data-tab-state="not-charged">
        {band}
        <span className="pay-end-mark pay-bad" aria-hidden>
          <XIcon className="pay-icon-xl" />
        </span>
        <h1>Not charged</h1>
        <p className="proof-line">The card charge failed. Nothing was charged.</p>
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

  // TO SIGN.
  const lines: Array<{ key: string; icon: React.ReactNode; label: string }> = [];
  if (tab.credit_cents > 0) lines.push({ key: "credit", icon: <WalletIcon className="pay-icon" />, label: `${money(tab.credit_cents)} credits` });
  if (card > 0) lines.push({ key: "card", icon: <SmartphoneIcon className="pay-icon" />, label: `${money(tab.card_bill_cents)} by card` });
  if (cash > 0) lines.push({ key: "cash", icon: <BanknoteIcon className="pay-icon" />, label: `${money(tab.cash_bill_cents)} cash received` });
  if (tip > 0) lines.push({ key: "tip", icon: <HandCoinsIcon className="pay-icon" />, label: `${money(tip)} tip` });

  return (
    <main className="proof verify" data-tab-state="verify">
      {band}
      {reconnecting}
      <div className="pay-guest">
        <span className="pay-guest-photo" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {tab.guest_photo ? <img src={tab.guest_photo} alt="" /> : <UserIcon className="pay-icon" />}
        </span>
        <span className="pay-guest-text">
          <span className="pay-guest-title">Guest&apos;s bill</span>
          <span className="pay-guest-place">{placeName}</span>
        </span>
      </div>
      <p className="verify-amount" aria-label={`Total ${money(total)}`}>
        {money(total)}
      </p>
      <ul className="pay-lines" aria-label="How the guest pays">
        {lines.map((l) => (
          <li key={l.key} data-pay-line={l.key}>
            {l.icon}
            <span>{l.label}</span>
          </li>
        ))}
      </ul>
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
            <p className="proof-line">Reject this bill?</p>
            <div className="yes-no">
              <button type="button" disabled={!!busy || !request} onClick={() => void reject()}>
                {busy === "reject" ? "Rejecting…" : "Yes, reject"}
              </button>
              <button type="button" className="quiet" onClick={() => setRejecting(false)}>
                No
              </button>
            </div>
          </div>
        ) : (
          <>
            <button type="submit" className="verify-sign pay-with-icon" disabled={!!busy || !request}>
              {busy === "sign" ? SIGN.signing : (
                <>
                  <CheckIcon className="pay-icon" />
                  Sign · final
                </>
              )}
            </button>
            <p className="pay-final-line">Check the amount. Signed payments can&apos;t be undone.</p>
            <button type="button" className="quiet pay-with-icon" disabled={!!busy || !request} onClick={() => setRejecting(true)}>
              <XIcon className="pay-icon" />
              Reject
            </button>
          </>
        )}
        {!request ? <p className="pay-final-line">Type the waiter code to sign or reject.</p> : null}
      </form>
    </main>
  );
}
