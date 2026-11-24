"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clockTime, moneyLabel, readAmount } from "@mesita/place-profile/lib/money";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { closeBill, getBill, openBill, sendBill, type BillRead, type BillState, type Refused, type Staff } from "@/lib/bill-api";
import { readStaff } from "@/lib/staff-key";
import { Bones } from "@/components/Bones";
import { BanknoteIcon, CoinsIcon, HandCoinsIcon, UserIcon, WalletIcon } from "@/app/tab/[token]/icons";

// THE WAITER'S BILL (MESITA-4823), by its state:
//
//   open       Bill and Tip, Send bill
//   sent       waiting for the guest: Edit, Cancel
//   declined   the same boxes, "The guest declined"
//   accepted   Collect $X, what it is made of, Received, Cancel
//   paid       the green screen, Next guest
//   cancelled, expired   why, Send again
//
// The tip is never picked for the guest: None until the waiter asks. The
// waiter never reads the guest's name or balance. Every peso is the server's.

const DONE: BillState[] = ["paid", "cancelled", "expired"];
const TIP_PCTS = [10, 15, 20] as const;

/** Every 2 s while it moves, 5 s after 30 s still, 10 s after 3 min. */
function nextDelay(stillMs: number): number {
  if (stillMs < 30_000) return 2000;
  return stillMs < 180_000 ? 5000 : 10_000;
}

/** A tip box: empty or 0 is no tip. */
function readTip(text: string): number | null {
  const t = text.trim();
  return t === "" || /^0+([.,]0*)?$/.test(t) ? 0 : readAmount(t);
}

export function BillScreen({ billId, placeId }: { billId: string; placeId: string }) {
  const router = useRouter();
  const [read, setRead] = useState<BillRead | null>(null);
  const [gone, setGone] = useState(false);
  const [misses, setMisses] = useState(0);
  const [editing, setEditing] = useState(false);
  const [billText, setBillText] = useState("");
  const [tipText, setTipText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const changedAt = useRef(0);
  const stamp = useRef("");

  const signIn = useCallback(() => router.replace(`/waiter/${encodeURIComponent(placeId)}`), [router, placeId]);
  const staff = useCallback((): Staff | null => {
    const token = readStaff(placeId);
    return token ? { place_id: placeId, staff_token: token } : null;
  }, [placeId]);

  const refresh = useCallback(async () => {
    const s = staff();
    if (!s) return signIn();
    const r = await getBill(s, billId);
    if (r === "failed") return setMisses((n) => n + 1);
    if ("refused" in r) {
      if (r.code === "staff_code_needed") return signIn();
      return setGone(true);
    }
    setMisses(0);
    const next = `${r.bill.state}:${r.bill.version}`;
    if (next !== stamp.current) {
      stamp.current = next;
      changedAt.current = Date.now();
    }
    setRead(r);
  }, [billId, signIn, staff]);

  const state = read?.bill.state ?? null;
  const stopped = gone || (state !== null && DONE.includes(state));
  useEffect(() => {
    if (stopped) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (document.visibilityState === "visible") await refresh();
      if (alive) timer = setTimeout(() => void loop(), nextDelay(Date.now() - changedAt.current));
    };
    void loop();
    const onShow = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [refresh, stopped]);

  function say(r: Refused) {
    if (r.code === "staff_code_needed") return signIn();
    setError(r.error);
  }

  /** One call at a time; whatever it answers, the screen reads the truth. */
  async function run(name: string, call: (s: Staff) => Promise<Refused | "failed" | { ok?: unknown } | object>): Promise<boolean> {
    const s = staff();
    if (!s) {
      signIn();
      return false;
    }
    if (busy) return false;
    setBusy(name);
    setError(null);
    try {
      const r = await call(s);
      if (r === "failed") {
        setError("Couldn't reach Mesita. Tap again.");
        return false;
      }
      if ("refused" in r) {
        say(r as Refused);
        await refresh();
        return false;
      }
      await refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  if (gone) {
    return (
      <main className="proof pay-end" data-bill="gone">
        <h1>This bill is gone</h1>
        <p className="proof-line">Scan the guest&apos;s QR again.</p>
      </main>
    );
  }
  if (!read) {
    return (
      <main className="proof" data-bill="loading">
        {misses >= 2 ? <p className="proof-status">Reconnecting…</p> : null}
        <Bones label="Opening the bill" />
      </main>
    );
  }

  const { bill, place, guest_photo: photo } = read;
  const m = (c: number) => moneyLabel(c, bill.currency);
  const placeName = place.name ?? "A Mesita place";
  const total = (bill.bill_cents ?? 0) + bill.tip_cents;
  const band = bill.test_mode ? (
    <p className="test-band" role="status" data-test-band>
      {TEST_BAND_TEXT}
    </p>
  ) : null;
  const reconnecting = misses >= 2 ? <p className="proof-status" role="status">Reconnecting…</p> : null;
  const alert = error ? (
    <p className="proof-status warn" role="alert">
      {error}
    </p>
  ) : null;
  const guest = (title: string, amount: number | null) => (
    <div className="pay-guest">
      <span className="pay-guest-photo" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo ? <img src={photo} alt="" /> : <UserIcon className="pay-icon" />}
      </span>
      <span className="pay-guest-text">
        <span className="pay-guest-title">{title}</span>
        <span className="pay-guest-place">{placeName}</span>
      </span>
      {amount !== null ? <p className="verify-amount">{m(amount)}</p> : null}
    </div>
  );
  const nextGuest = () => router.replace(`/waiter/${encodeURIComponent(placeId)}`);
  const sendAgain = () =>
    run("again", async (s) => {
      const r = await openBill(s, { again_bill_id: billId });
      if (r !== "failed" && !("refused" in r)) router.replace(`/bill/${r.bill_id}?place=${encodeURIComponent(placeId)}`);
      return r;
    });

  // PAID.
  if (bill.state === "paid") {
    const collected = bill.outside_cents ?? 0;
    return (
      <main className="tab-paid" data-bill="paid">
        {band}
        <span className="tab-paid-tick" aria-hidden>
          ✓
        </span>
        <p className="tab-paid-title" role="status">
          Paid
        </p>
        <p className="tab-paid-amount">{m(total - bill.discount_cents)}</p>
        {bill.credit_cents > 0 ? <p className="tab-paid-line">{m(bill.credit_cents)} with credits</p> : null}
        <p className="tab-paid-line">{collected > 0 ? `${m(collected)} cash or card` : "Nothing to collect"}</p>
        <p className="tab-paid-line">{placeName}</p>
        {/* Friends who split: each shows their own QR. */}
        <button type="button" className="quiet" style={{ marginTop: 24, color: "#ffffff" }} onClick={nextGuest}>
          Next guest at this table
        </button>
      </main>
    );
  }

  // OVER.
  if (bill.state === "cancelled" || bill.state === "expired") {
    return (
      <main className="proof pay-end" data-bill={bill.state}>
        {band}
        <h1>{bill.state === "expired" ? "This bill expired" : "This bill was cancelled"}</h1>
        {/* Cash may already have changed hands: never "nothing was paid". */}
        <p className="proof-line">
          {bill.bill_cents ? `${m(total)}. No credits were used. Send it again if the guest still wants Mesita.` : "Nothing was sent."}
        </p>
        {alert}
        <button type="button" style={{ marginTop: 16, alignSelf: "stretch" }} disabled={busy !== null} onClick={() => void sendAgain()}>
          {busy === "again" ? "Opening…" : "Send again"}
        </button>
        <button type="button" className="quiet" style={{ alignSelf: "stretch" }} onClick={nextGuest}>
          Next guest
        </button>
      </main>
    );
  }

  const cancelRow = cancelling ? (
    <div className="pay-reject-confirm" role="group" aria-label="Cancel this bill?">
      <p className="proof-line pay-reject-title">Cancel this bill?</p>
      {bill.state === "accepted" ? <p className="pay-final-line">No credits are used. Give back any money the guest already paid.</p> : null}
      <div className="yes-no">
        <button type="button" className="verify-reject" disabled={busy !== null} onClick={() => void run("cancel", (s) => closeBill(s, billId, "cancel")).then(() => setCancelling(false))}>
          {busy === "cancel" ? "Cancelling…" : "Yes, cancel"}
        </button>
        <button type="button" className="quiet" onClick={() => setCancelling(false)}>
          No
        </button>
      </div>
    </div>
  ) : null;

  // COLLECT.
  if (bill.state === "accepted" || bill.state === "confirming") {
    const due = bill.outside_cents ?? 0;
    const lines = [
      { key: "bill", icon: <CoinsIcon className="pay-icon" />, label: "Bill", value: m(bill.bill_cents ?? 0), on: true },
      { key: "discount", icon: <CoinsIcon className="pay-icon" />, label: "Discount", value: `−${m(bill.discount_cents)}`, on: bill.discount_cents > 0, good: true },
      { key: "credit", icon: <WalletIcon className="pay-icon" />, label: "Credits", value: `−${m(bill.credit_cents)}`, on: bill.credit_cents > 0, good: true },
      { key: "tip", icon: <HandCoinsIcon className="pay-icon" />, label: "Tip", value: m(bill.tip_cents), on: bill.tip_cents > 0 },
      { key: "collect", icon: <BanknoteIcon className="pay-icon" />, label: "Cash or card", value: m(due), on: true },
    ].filter((l) => l.on);
    return (
      <main className="proof verify" data-bill="collect">
        {band}
        {reconnecting}
        <p className="proof-line" role="status">
          The guest accepted
        </p>
        <p className="proof-amount">Collect {m(due)}</p>
        <section className="verify-box" aria-label="The bill">
          {guest("Guest's bill", null)}
          <ul className="pay-lines">
            {lines.map((l) => (
              <li key={l.key} className={l.good ? "pay-line-good" : undefined}>
                {l.icon}
                <span className="pay-line-label">{l.label}</span>
                <span className="pay-line-value">{l.value}</span>
              </li>
            ))}
          </ul>
        </section>
        {alert}
        {cancelRow ?? (
          <div className="verify-actions" style={{ alignSelf: "stretch", marginTop: 12 }}>
            <button type="button" className="verify-reject" disabled={busy !== null || bill.state === "confirming"} onClick={() => setCancelling(true)}>
              Cancel
            </button>
            <button type="button" className="verify-sign" disabled={busy !== null} onClick={() => void run("received", (s) => closeBill(s, billId, "received"))}>
              {busy === "received" || bill.state === "confirming" ? "Confirming…" : "Received"}
            </button>
          </div>
        )}
        <p className="proof-line proof-clock">Open until {clockTime(bill.expires_at)}</p>
      </main>
    );
  }

  // WAITING FOR THE GUEST.
  if (bill.state === "sent" && !editing) {
    return (
      <main className="proof verify" data-bill="sent">
        {band}
        {reconnecting}
        <section className="verify-box" aria-label="The bill">
          {guest("Waiting for the guest", total)}
          <ul className="pay-lines">
            <li>
              <CoinsIcon className="pay-icon" />
              <span className="pay-line-label">Bill</span>
              <span className="pay-line-value">{m(bill.bill_cents ?? 0)}</span>
            </li>
            <li>
              <HandCoinsIcon className="pay-icon" />
              <span className="pay-line-label">Tip</span>
              <span className="pay-line-value">{bill.tip_cents > 0 ? m(bill.tip_cents) : "None"}</span>
            </li>
          </ul>
        </section>
        <p className="proof-line" role="status">
          Ask the guest to accept on their phone.
        </p>
        {alert}
        {cancelRow ?? (
          <div className="yes-no" style={{ alignSelf: "stretch", marginTop: 12 }}>
            <button
              type="button"
              className="quiet"
              onClick={() => {
                setBillText(bill.bill_cents ? String(bill.bill_cents / 100) : "");
                setTipText(bill.tip_cents ? String(bill.tip_cents / 100) : "");
                setEditing(true);
              }}
            >
              Edit
            </button>
            <button type="button" className="quiet" onClick={() => setCancelling(true)}>
              Cancel
            </button>
          </div>
        )}
        <p className="proof-line proof-clock">Open until {clockTime(bill.expires_at)}</p>
      </main>
    );
  }

  // TYPE THE BILL: open, declined, or an edit.
  const billCents = readAmount(billText);
  const tipCents = readTip(tipText);
  const tipHigh = billCents !== null && tipCents !== null && tipCents * 2 > billCents;
  const pct = (p: number) => Math.round(((billCents ?? 0) * p) / 100);
  return (
    <main className="proof" data-bill="type">
      {band}
      {reconnecting}
      {bill.state === "declined" ? (
        <p className="proof-status warn" role="status">
          The guest declined {m(total)}. Fix it and send again.
        </p>
      ) : null}
      <form
        style={{ alignSelf: "stretch" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (billCents === null || tipCents === null) return;
          void run("send", (s) => sendBill(s, { bill_id: billId, version: bill.version, bill_cents: billCents, tip_cents: tipCents })).then((ok) => {
            if (ok) setEditing(false);
          });
        }}
      >
        <div className="verify-box">{guest(editing ? "Edit the bill" : "New bill", billCents !== null && tipCents !== null ? billCents + tipCents : null)}</div>
        <label className="field">
          Bill, before tip
          <input inputMode="decimal" autoComplete="off" placeholder="0" value={billText} onChange={(e) => setBillText(e.target.value)} />
        </label>
        <label className="field">
          Tip (ask the guest)
          <input inputMode="decimal" autoComplete="off" placeholder="None" value={tipText} onChange={(e) => setTipText(e.target.value)} />
        </label>
        <div className="tip-chips" role="group" aria-label="Tip">
          {TIP_PCTS.map((p) => (
            <button
              key={p}
              type="button"
              className="quiet"
              disabled={billCents === null}
              aria-pressed={billCents !== null && tipCents !== null && tipCents > 0 && tipCents === pct(p)}
              onClick={() => setTipText(String(pct(p) / 100))}
            >
              {p}%
            </button>
          ))}
          <button type="button" className="quiet" aria-pressed={tipCents === 0} onClick={() => setTipText("")}>
            None
          </button>
        </div>
        {tipHigh ? (
          <p className="proof-status warn" role="status">
            Tip is more than half the bill. Check it.
          </p>
        ) : null}
        {alert}
        <button type="submit" style={{ minHeight: 56 }} disabled={busy !== null || billCents === null || tipCents === null}>
          {busy === "send" ? "Sending…" : "Send bill"}
        </button>
        {editing ? (
          <button type="button" className="quiet" onClick={() => setEditing(false)}>
            Keep the bill as it is
          </button>
        ) : null}
      </form>
    </main>
  );
}
