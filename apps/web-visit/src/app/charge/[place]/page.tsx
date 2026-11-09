"use client";

import { use, useEffect, useRef, useState } from "react";
import { clockTime, moneyLabel, readAmount } from "@mesita/place-profile/lib/money";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { ChargeError, getCharge, openCharge, type OpenedCharge } from "@/lib/visit-api";

// /charge/<place> — the waiter's charge (MESITA-3306, W2c). Staff type the
// place code, the amount and an optional ticket; the guest types the 4-digit
// code on their Pay tab and pays that amount, locked. This screen polls the
// charge every 3 s with its token only (never the place code) and has four
// states: Open (the code big, the amount, "N min left"), Paid (one green
// tick, the one authored motion), Expired ("Open a new charge") and
// "Reconnecting…" after two failed polls. Waiting on the guest is not a
// state: Open stays until the payment lands or the code runs out. Nothing
// here says who paid.

const POLL_MS = 3000;

type Screen =
  | { kind: "form" }
  | { kind: "open"; charge: OpenedCharge; offset: number }
  | { kind: "paid"; charge: OpenedCharge; paidAt: string }
  | { kind: "expired"; testMode: boolean };

export default function ChargePage({ params }: { params: Promise<{ place: string }> }) {
  const { place } = use(params);
  const [screen, setScreen] = useState<Screen>({ kind: "form" });
  const [placeCode, setPlaceCode] = useState("");
  const [amount, setAmount] = useState("");
  const [ticket, setTicket] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const charge = screen.kind === "open" ? screen.charge : null;
  const offset = screen.kind === "open" ? screen.offset : 0;
  const tokenRef = useRef<string | null>(null);

  // The poll: by token, every 3 s, until Paid or Expired.
  useEffect(() => {
    if (!charge) return;
    const token = charge.charge_token;
    tokenRef.current = token;
    let stopped = false;
    const tick = async () => {
      const r = await getCharge(token);
      if (stopped || tokenRef.current !== token) return;
      if (r === "failed") return setMisses((n) => n + 1);
      setMisses(0);
      if (r === "gone") {
        stopped = true;
        setScreen({ kind: "expired", testMode: charge.test_mode });
      } else if (r.state === "paid") {
        stopped = true;
        setScreen({ kind: "paid", charge, paidAt: r.paid_at ?? new Date().toISOString() });
      }
    };
    const poll = setInterval(() => void tick(), POLL_MS);
    const clock = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => {
      stopped = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [charge, offset]);

  const cents = readAmount(amount);
  const codeOk = /^\d{6}$/.test(placeCode.replace(/\s/g, ""));
  const canOpen = codeOk && cents !== null && !busy;

  async function open() {
    if (!canOpen || cents === null) return;
    setBusy(true);
    setError(null);
    try {
      const c = await openCharge({ place_id: place, place_code: placeCode.replace(/\s/g, ""), amount_cents: cents, ticket: ticket.trim() || null });
      setMisses(0);
      setNow(Date.parse(c.server_time));
      setScreen({ kind: "open", charge: c, offset: Date.parse(c.server_time) - Date.now() });
    } catch (e) {
      if (e instanceof ChargeError && e.code === "locked" && e.retryAfterS) {
        setError(`${e.message} Try again in ${Math.ceil(e.retryAfterS / 60)} min.`);
      } else {
        setError(e instanceof Error ? e.message : "Couldn't open the charge. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  function again() {
    tokenRef.current = null;
    setAmount("");
    setTicket("");
    setError(null);
    setScreen({ kind: "form" });
  }

  const testMode = screen.kind === "open" || screen.kind === "paid" ? screen.charge.test_mode : screen.kind === "expired" ? screen.testMode : false;
  const band = testMode ? (
    <p className="test-band" role="status" data-test-band>
      {TEST_BAND_TEXT}
    </p>
  ) : null;

  if (screen.kind === "paid") {
    const c = screen.charge;
    return (
      <main className="proof" data-charge-state="paid">
        {band}
        <span className="charge-tick" aria-hidden>
          ✓
        </span>
        <p className="proof-status" role="status">
          Paid · {clockTime(screen.paidAt)}
        </p>
        <p className="proof-amount">{moneyLabel(c.amount_cents, c.currency)}</p>
        {c.ticket ? <p className="proof-line">Ticket {c.ticket}</p> : null}
        <p className="proof-place">{c.place.name ?? "A Mesita place"}</p>
        <div className="proof-foot">
          <button type="button" onClick={again}>
            New charge
          </button>
        </div>
      </main>
    );
  }

  if (screen.kind === "expired") {
    return (
      <main className="proof" data-charge-state="expired">
        {band}
        <p className="proof-status warn" role="alert">
          This code expired.
        </p>
        <div className="proof-foot">
          <button type="button" onClick={again}>
            Open a new charge
          </button>
        </div>
      </main>
    );
  }

  if (screen.kind === "open") {
    const c = screen.charge;
    const minutes = Math.max(0, Math.ceil((Date.parse(c.expires_at) - now) / 60_000));
    return (
      <main className="proof" data-charge-state="open">
        {band}
        {misses >= 2 ? (
          <p className="proof-status" role="status" data-charge-state="reconnecting">
            Reconnecting…
          </p>
        ) : null}
        <p className="proof-line">The guest types this code on Mesita Pay</p>
        <p className="charge-code" aria-label={`Code ${c.code.split("").join(" ")}`}>
          {c.code}
        </p>
        <p className="proof-amount charge-amount">{moneyLabel(c.amount_cents, c.currency)}</p>
        {c.ticket ? <p className="proof-line">Ticket {c.ticket}</p> : null}
        <p className="proof-line proof-clock" aria-live="polite">
          {minutes} min left
        </p>
        <p className="proof-place">{c.place.name ?? "A Mesita place"}</p>
      </main>
    );
  }

  return (
    <main className="proof" data-charge-state="form">
      <h1>Waiter&apos;s charge</h1>
      <p>The guest pays it on Mesita with the code this opens.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void open();
        }}
        style={{ alignSelf: "stretch" }}
      >
        <label className="field">
          Place code
          <input
            className="secret"
            inputMode="numeric"
            autoComplete="off"
            maxLength={7}
            value={placeCode}
            onChange={(e) => setPlaceCode(e.target.value)}
          />
        </label>
        <label className="field">
          Amount
          <input inputMode="decimal" autoComplete="off" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field">
          Ticket or table no. (optional)
          <input autoComplete="off" maxLength={32} value={ticket} onChange={(e) => setTicket(e.target.value)} />
        </label>
        {error ? (
          <p className="proof-status warn" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={!canOpen}>
          {busy ? "Opening…" : "Open charge"}
        </button>
      </form>
    </main>
  );
}
