"use client";

import { use, useEffect, useRef, useState } from "react";
import { clockTime, moneyLabel, readAmount } from "@mesita/place-profile/lib/money";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { ChargeError, type ChargeRead, confirmCharge, getCharge, openCharge, type OpenedCharge } from "@/lib/visit-api";

// /charge/<place> — the waiter's charge (MESITA-3306, W2c). Staff type the
// place code, the amount and an optional ticket; the guest types the 4-digit
// code on their Pay tab and pays that amount, locked. This screen polls the
// charge every 3 s with its token only (never the place code) and has four
// states: Open (the code big, the amount, "N min left"), Paid (one green
// tick, the one authored motion), Expired ("Open a new charge") and
// "Reconnecting…" after two failed polls. Waiting on the guest is not a
// state: Open stays until the payment lands or the code runs out. Nothing
// here says who paid.
//
// MESITA-3545 (Payments Flow v2): staff may type the tip they asked the
// guest (optional; empty lets the guest choose). When the guest chooses to
// pay the waiter (cash or the place's terminal), Open becomes "Pay the
// waiter": no code, "Collect $NMX" (the bill part plus the tip), one clock
// "Confirm within N min" (that bill's own 30 minutes) and one Received
// button pinned at the bottom. Received is the one staff step; nothing after
// it. A guest who cancels paying the waiter brings Open back. Paid reads
// what moved on Mesita: "Received" for a bill paid to the waiter, "Collect
// $NMX at the table" for a lowered card part, "Collect the $NMX tip in
// person" for a tip that never went through Mesita.

const POLL_MS = 3000;

// The open charge survives a reload or a locked phone (MESITA-3545): the
// token is the only key to Received, so it is kept in this tab's
// sessionStorage under the place, and dropped at Paid, Expired or a new
// charge. Never the place code.
const keyFor = (place: string) => `mesita.charge.${place}`;
function saveCharge(place: string, c: OpenedCharge | null) {
  try {
    if (c) sessionStorage.setItem(keyFor(place), JSON.stringify(c));
    else sessionStorage.removeItem(keyFor(place));
  } catch {
    // Private mode: a reload starts over; nothing else breaks.
  }
}
function loadCharge(place: string): OpenedCharge | null {
  try {
    const raw = sessionStorage.getItem(keyFor(place));
    const c = raw ? (JSON.parse(raw) as OpenedCharge) : null;
    return c && typeof c.charge_token === "string" ? c : null;
  } catch {
    return null;
  }
}

type Screen =
  | { kind: "form" }
  | { kind: "open"; charge: OpenedCharge; offset: number }
  | { kind: "paid"; charge: OpenedCharge; paidAt: string; read: ChargeRead | null; received: boolean; cashbackCents?: number }
  | { kind: "expired"; testMode: boolean };

export default function ChargePage({ params }: { params: Promise<{ place: string }> }) {
  const { place } = use(params);
  const [screen, setScreen] = useState<Screen>({ kind: "form" });
  const [placeCode, setPlaceCode] = useState("");
  const [amount, setAmount] = useState("");
  const [tip, setTip] = useState("");
  const [ticket, setTicket] = useState("");
  const [last, setLast] = useState<ChargeRead | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const charge = screen.kind === "open" ? screen.charge : null;
  const offset = screen.kind === "open" ? screen.offset : 0;
  const tokenRef = useRef<string | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  // Back to the open charge after a reload; the poll then says where it stands.
  useEffect(() => {
    const id = setTimeout(() => {
      const c = loadCharge(place);
      if (c) setScreen((s) => (s.kind === "form" ? { kind: "open", charge: c, offset: 0 } : s));
    }, 0);
    return () => clearTimeout(id);
  }, [place]);

  // Paid, Expired and a new charge end it.
  useEffect(() => {
    if (screen.kind === "open") saveCharge(place, screen.charge);
    else if (screen.kind !== "form") saveCharge(place, null);
  }, [screen, place]);

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
        setScreen({ kind: "paid", charge, paidAt: r.paid_at ?? new Date().toISOString(), read: r, received: r.paid_outside });
      } else {
        // The guest stopped paying the waiter: the code is open again.
        setLast((prev) => {
          if (prev?.outside && !r.outside) setCancelled(true);
          if (r.outside) setCancelled(false);
          return r;
        });
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

  // Every state change moves focus to that state's primary button.
  const outsideNow = screen.kind === "open" && !!last?.outside;
  useEffect(() => {
    primaryRef.current?.focus();
  }, [screen.kind, outsideNow]);

  const cents = readAmount(amount);
  const tipCents = tip.trim() === "" ? 0 : readAmount(tip);
  const codeOk = /^\d{6}$/.test(placeCode.replace(/\s/g, ""));
  const canOpen = codeOk && cents !== null && tipCents !== null && !busy;
  const tipHigh = cents !== null && tipCents !== null && tipCents > cents / 2;

  async function open() {
    if (!canOpen || cents === null || tipCents === null) return;
    setBusy(true);
    setError(null);
    try {
      const c = await openCharge({ place_id: place, place_code: placeCode.replace(/\s/g, ""), amount_cents: cents, tip_cents: tipCents, ticket: ticket.trim() || null });
      setMisses(0);
      setLast(null);
      setCancelled(false);
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

  // The waiter's Received on the bill the guest pays to the waiter.
  async function receive() {
    if (screen.kind !== "open" || receiving) return;
    const c = screen.charge;
    setReceiving(true);
    setError(null);
    try {
      const r = await confirmCharge(c.charge_token);
      if (r === "failed") setError("Couldn't reach Mesita. Tap Received again.");
      else if ("refused" in r) {
        setError(r.refused);
        setLast((prev) => (prev ? { ...prev, outside: null } : prev));
      } else {
        setScreen({ kind: "paid", charge: c, paidAt: r.paid_at, read: last, received: true, cashbackCents: r.cashback_cents });
      }
    } finally {
      setReceiving(false);
    }
  }

  function again() {
    saveCharge(place, null);
    tokenRef.current = null;
    setAmount("");
    setTip("");
    setTicket("");
    setLast(null);
    setCancelled(false);
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
    const r = screen.read;
    const tipPaid = r?.tip_cents ?? 0;
    // What the guest settled: to the waiter (Received), part on Mesita, or all on Mesita.
    let status: string;
    let big: string;
    const lines: Array<{ text: string; warn?: boolean }> = [];
    if (screen.received) {
      const collected = (r?.outside?.cents ?? (r ? c.amount_cents - (r.paid_cents ?? 0) : c.amount_cents)) + tipPaid;
      status = `Received · ${clockTime(screen.paidAt)}`;
      big = moneyLabel(collected, c.currency);
      // The guest's cashback at the place's own rate (MESITA-3589), when known.
      if ((screen.cashbackCents ?? 0) > 0) lines.push({ text: `${moneyLabel(screen.cashbackCents ?? 0, c.currency)} back to the guest` });
    } else {
      const paid = r?.paid_cents ?? c.amount_cents;
      status = `Paid · ${clockTime(screen.paidAt)}`;
      big = `Paid ${moneyLabel(paid, c.currency)}`;
      if (paid < c.amount_cents) lines.push({ text: `Collect ${moneyLabel(c.amount_cents - paid, c.currency)} at the table`, warn: true });
      if (tipPaid > 0) lines.push({ text: `${moneyLabel(tipPaid, c.currency)} tip` });
      else if (c.tip_cents > 0) lines.push({ text: `Collect the ${moneyLabel(c.tip_cents, c.currency)} tip in person`, warn: true });
    }
    return (
      <main className="proof" data-charge-state="paid">
        {band}
        <span className="charge-tick" aria-hidden>
          ✓
        </span>
        <p className="proof-status" role="status">
          {status}
        </p>
        <p className="proof-amount">{big}</p>
        {lines.map((l) => (
          <p key={l.text} className={l.warn ? "proof-status warn" : "proof-line"}>
            {l.text}
          </p>
        ))}
        {c.ticket ? <p className="proof-line">Ticket {c.ticket}</p> : null}
        <p className="proof-place">{c.place.name ?? "A Mesita place"}</p>
        <div className="proof-foot">
          <button type="button" ref={primaryRef} onClick={again}>
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
          {cancelled ? "The guest cancelled paying the waiter. This code expired." : "This code expired."}
        </p>
        <div className="proof-foot">
          <button type="button" ref={primaryRef} onClick={again}>
            Open a new charge
          </button>
        </div>
      </main>
    );
  }

  if (screen.kind === "open") {
    const c = screen.charge;
    const outside = last?.outside ?? null;
    const reconnecting = misses >= 2 ? (
      <p className="proof-status" role="status" data-charge-state="reconnecting">
        Reconnecting…
      </p>
    ) : null;
    const alert = error ? (
      <p className="proof-status warn" role="alert">
        {error}
      </p>
    ) : null;

    if (outside) {
      // Paying the waiter: no code; the bill's own clock.
      const collect = outside.cents + outside.tip_cents;
      const credit = c.amount_cents - outside.cents;
      const minutes = Math.max(0, Math.ceil((Date.parse(outside.expires_at ?? c.expires_at) - now) / 60_000));
      return (
        <main className="proof" data-charge-state="open" data-charge-outside>
          {band}
          {reconnecting}
          <p className="proof-line" role="status">
            Pay the waiter
          </p>
          <p className="proof-amount">Collect {moneyLabel(collect, c.currency)}</p>
          <p className="proof-line">
            {moneyLabel(outside.cents, c.currency)} bill
            {outside.tip_cents > 0 ? ` · ${moneyLabel(outside.tip_cents, c.currency)} tip` : ""}
          </p>
          {credit > 0 ? <p className="proof-line">{moneyLabel(credit, c.currency)} already paid from credit</p> : null}
          {c.ticket ? <p className="proof-line">Ticket {c.ticket}</p> : null}
          <p className="proof-line proof-clock" aria-live="polite">
            Confirm within {minutes} min
          </p>
          {alert}
          <p className="proof-place">{c.place.name ?? "A Mesita place"}</p>
          <div className="proof-foot charge-receive">
            <button type="button" ref={primaryRef} onClick={() => void receive()} disabled={receiving} style={{ width: "100%", minHeight: 56 }}>
              {receiving ? "Confirming…" : `Received ${moneyLabel(collect, c.currency)}`}
            </button>
          </div>
        </main>
      );
    }

    const minutes = Math.max(0, Math.ceil((Date.parse(c.expires_at) - now) / 60_000));
    const tipNow = last ? last.tip_cents : c.tip_cents;
    return (
      <main className="proof" data-charge-state="open">
        {band}
        {reconnecting}
        {cancelled ? (
          <p className="proof-status warn" role="status">
            The guest cancelled paying the waiter
          </p>
        ) : null}
        {alert}
        <p className="proof-line">The guest types this code in the Mesita app</p>
        <p className="charge-code" aria-label={`Code ${c.code.split("").join(" ")}`}>
          {c.code}
        </p>
        <p className="proof-amount charge-amount">{moneyLabel(c.amount_cents, c.currency)}</p>
        {tipNow > 0 ? <p className="proof-line">+ {moneyLabel(tipNow, c.currency)} tip</p> : null}
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
          Waiter code
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
          Tip (optional)
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="Leave empty and the guest chooses"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
          />
        </label>
        {tipHigh ? (
          <p className="proof-status warn" role="status">
            Tip is more than half the bill. Check it.
          </p>
        ) : null}
        <label className="field">
          Ticket or table no. (optional)
          <input autoComplete="off" maxLength={32} value={ticket} onChange={(e) => setTicket(e.target.value)} />
        </label>
        {error ? (
          <p className="proof-status warn" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" ref={primaryRef} disabled={!canOpen}>
          {busy ? "Opening…" : "Open charge"}
        </button>
      </form>
    </main>
  );
}
