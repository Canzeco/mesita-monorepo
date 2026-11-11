"use client";

import { useEffect, useState } from "react";
import { clockTime, moneyLabel, readAmount } from "@mesita/place-profile/lib/money";
import { payChecklist, verifyLabel } from "@mesita/place-profile/lib/pay-checklist";
import { type TabRead, type TabRefusal, verifyTab } from "@/lib/visit-api";
import { isStaffQrToken, keepStaff, readStaff, rememberNext } from "@/lib/staff-key";

// The waiter's side of a guest's payment (MESITA-3708). The guest typed the
// amount, chose how to pay and paid; the waiter scanned their QR and lands
// here. Top to bottom: the amount before tip (to match the ticket), the tip,
// the same checklist the guest sees, one action line, the live clock, and one
// button that names the action. Only a phone signed in by the owner's Staff
// QR may verify; any other phone sees "Scan your Staff QR" and nothing else.

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
  const [cash, setCash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // This phone's own verify, so "already verified" can tell this phone from another.
  const [mine, setMine] = useState<{ at: string; outcome: "verified" | "already_verified"; samePhone: boolean | null } | null>(null);
  const [, bump] = useState(0);

  const placeId = tab.place.id;
  const staffToken = readStaff(placeId);
  const canVerify = isStaffQrToken(staffToken);
  const money = (c: number) => moneyLabel(c, tab.currency);
  const owed = tab.cash_bill_cents + tab.cash_tip_cents;
  const tip = tab.cash_tip_cents + tab.card_tip_cents;
  const closed = tab.status === "expired" || tab.status === "cancelled";
  const verifiedAt = mine?.at ?? tab.verified_at ?? null;

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

  // The cash field: prefilled with what is owed; it can only go down.
  const cashCents = cash.trim() === "" ? owed : readAmount(cash);
  const cashOk = cashCents !== null && cashCents <= owed;

  function refused(r: TabRefusal) {
    if (r.code === "staff_qr_needed") {
      keepStaff(placeId, null, null);
      bump((n) => n + 1);
      setError("Scan your Staff QR");
      return;
    }
    if (r.code === "short" && typeof r.detail.missing_cents === "number" && cashCents !== null) {
      setError(`${money(r.detail.missing_cents)} short. Ask for ${money(r.detail.missing_cents)} more, or verify ${money(cashCents)} received.`);
      return;
    }
    if (r.code === "card_pending") return setError("Card still going through");
    if (r.code === "expired") return setError(`This payment closed at ${clockTime(tab.expires_at)}.`);
    if (r.code === "forbidden") return setError("This payment is for another place.");
    if (r.code === "gone") return setError("Scan the guest's screen again.");
    setError(r.error);
  }

  async function verify() {
    if (!staffToken || !canVerify || busy || !cashOk) return;
    setBusy(true);
    setError(null);
    try {
      const r = await verifyTab({ token, place_id: placeId, staff_token: staffToken, cash_received_cents: owed > 0 ? cashCents : null });
      if (r === "failed") return setError("Couldn't reach Mesita. Tap Verify again.");
      if ("refused" in r) {
        refused(r);
        if (r.code === "card_pending") setTimeout(() => void onChanged(), 2000);
        else if (r.code !== "short") await onChanged();
        return;
      }
      setMine({ at: r.verified_at ?? new Date().toISOString(), outcome: r.outcome, samePhone: r.outcome === "verified" ? true : r.same_phone });
      if (r.outcome === "verified") vibrate();
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  // Scanned after a Verify: ask once which phone it was (moves no money).
  const askWho = !!tab.verified_at && canVerify && !mine && !busy;
  useEffect(() => {
    if (!askWho) return;
    const t = setTimeout(() => void verify(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askWho]);

  // No Staff QR on this phone: remember this payment, so scanning the Staff
  // QR brings the waiter straight back here (the /staff page reads it).
  useEffect(() => {
    if (!canVerify && !closed && !tab.verified_at) rememberNext(`/tab/${token}`);
  }, [canVerify, closed, tab.verified_at, token]);

  // Verified: green; by this phone earlier: the warning tone; by another
  // phone: red, which outranks green.
  if (verifiedAt) {
    const another = mine ? mine.samePhone === false : null;
    if (another) {
      return (
        <main className="tab-paid tab-paid-alert" data-tab-state="verified-elsewhere" role="alert">
          {band}
          <span className="tab-paid-tick" aria-hidden>!</span>
          <p className="tab-paid-title">Verified by another phone at {clockTime(verifiedAt)}</p>
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
          {again ? "Already verified" : "Verified"} · {clockTime(verifiedAt)}
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

  if (!canVerify) {
    return (
      <main className="proof" data-tab-state="staff-qr-needed">
        {band}
        <p className="proof-status warn" role="alert">
          Scan your Staff QR
        </p>
        <p className="proof-line">Then scan the guest&apos;s screen again.</p>
        <p className="proof-place">{tab.place.name ?? "A Mesita place"}</p>
      </main>
    );
  }

  return (
    <main className="proof" data-tab-state="verify">
      {band}
      {reconnecting}
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
          void verify();
        }}
        style={{ alignSelf: "stretch" }}
      >
        {owed > 0 ? (
          <label className="field">
            Cash received
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder={money(owed).replace(/^[^\d]*/, "")}
              value={cash}
              onChange={(e) => setCash(e.target.value)}
            />
            <span className="field-hint">Empty means exactly {money(owed)}. Give change by hand.</span>
          </label>
        ) : null}
        {!cashOk && cashCents !== null ? (
          <p className="proof-status warn" role="alert">
            That&apos;s more than the guest owes ({money(owed)}).
          </p>
        ) : null}
        {error ? (
          <p className="proof-status warn" role="alert" aria-live="polite">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy || !cashOk || tab.card_pending === true} style={{ minHeight: 56 }}>
          {busy ? "Verifying…" : verifyLabel({ cashBillCents: owed > 0 ? cashCents ?? owed : 0, cashTipCents: 0 }, money)}
        </button>
      </form>
      <p className="proof-place">{tab.place.name ?? "A Mesita place"}</p>
    </main>
  );
}
