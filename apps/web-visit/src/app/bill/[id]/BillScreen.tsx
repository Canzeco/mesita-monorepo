"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clockTime, moneyLabel } from "@mesita/place-profile/lib/money";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { closeBill, getBill, keepBillStaff, openBill, readBillStaff, sendBill, signIn as checkCode, type BillRead, type BillState, type Refused, type Staff } from "@/lib/bill-api";
import { BillEntry, CodeEntry, WaiterSteps } from "@/components/BillEntry";
import { Bones } from "@/components/Bones";
import { BanknoteIcon, CoinsIcon, HandCoinsIcon, UserIcon, WalletIcon } from "@/app/tab/[token]/icons";

// THE WAITER'S BILL (MESITA-4823), by its state:
//
// Steps 2 to 4 of the waiter's four (BillEntry; MESITA-4878):
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
/** Every 2 s while it moves, 5 s after 30 s still, 10 s after 3 min. */
function nextDelay(stillMs: number): number {
  if (stillMs < 30_000) return 2000;
  return stillMs < 180_000 ? 5000 : 10_000;
}

export function BillScreen({ billId }: { billId: string }) {
  const router = useRouter();
  const [read, setRead] = useState<BillRead | null>(null);
  const [gone, setGone] = useState(false);
  const [misses, setMisses] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [checking, setChecking] = useState(false);
  const changedAt = useRef(0);
  const stamp = useRef("");

  // Another phone, a closed tab or a new code: the code is typed again.
  const [locked, setLocked] = useState(false);
  const signIn = useCallback(() => {
    keepBillStaff(billId, null);
    setLocked(true);
  }, [billId]);
  const staff = useCallback((): Staff | null => readBillStaff(billId), [billId]);

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
  const stopped = gone || locked || (state !== null && DONE.includes(state));
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

  async function unlock(code: string): Promise<boolean> {
    if (busy) return false;
    setBusy("code");
    setError(null);
    const r = await checkCode(code, { bill_id: billId });
    setBusy(null);
    if (r === "failed" || "refused" in r) {
      setError(r === "failed" ? "Couldn't reach Mesita. Tap again." : r.error);
      return r === "failed";
    }
    keepBillStaff(billId, { place_id: r.place.id, staff_token: r.staff_token, waiter: r.waiter?.name ?? null });
    setLocked(false);
    return true;
  }

  if (locked) return <CodeEntry label="Open bill" busy={busy === "code"} error={error} onCode={unlock} />;
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

  const { bill, place, guest_photo: photo, guest_name: guestName } = read;
  const waiter = staff()?.waiter ?? null;
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
        <span className="pay-guest-place">{[guestName, placeName].filter(Boolean).join(" · ")}</span>
      </span>
      {amount !== null ? <p className="verify-amount">{m(amount)}</p> : null}
    </div>
  );
  const sendAgain = () =>
    run("again", async (s) => {
      const r = await openBill(s, { again_bill_id: billId });
      if (r !== "failed" && !("refused" in r)) {
        keepBillStaff(r.bill_id, s);
        router.replace(`/bill/${r.bill_id}`);
      }
      return r;
    });

  // PAID.
  if (bill.state === "paid") {
    const collected = bill.outside_cents ?? 0;
    const lines: [string, string][] = [["Bill", m(bill.bill_cents ?? 0)]];
    if (bill.discount_cents > 0) lines.push(["Discount", `−${m(bill.discount_cents)}`]);
    if (bill.credit_cents > 0) lines.push(["Credits", `−${m(bill.credit_cents)}`]);
    lines.push(["Tip", bill.tip_cents > 0 ? m(bill.tip_cents) : "None"]);
    if (waiter) lines.push(["Waiter", waiter]);
    // STEP 4, RECEIPT.
    return (
      <main className="proof verify" data-bill="paid">
        {band}
        <WaiterSteps at={4} />
        <section className="wp-paid" role="status">
          <span className="wp-paid-title">✓ Paid</span>
          <span className="wp-paid-amount">{collected > 0 ? m(collected) : "Nothing to collect"}</span>
          {collected > 0 ? <span>Cash or card</span> : null}
        </section>
        <section className="verify-box" aria-label="Receipt">
          {guest("Receipt", null)}
          <ul className="pay-lines">
            {lines.map(([label, value]) => (
              <li key={label}>
                <span className="pay-line-label">{label}</span>
                <span className="pay-line-value">{value}</span>
              </li>
            ))}
          </ul>
        </section>
        {/* Friends who split: each shows their own QR. */}
        <p className="proof-line">Another guest? Scan their QR.</p>
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

  const receive = () => void run("received", (s) => closeBill(s, billId, "received")).then(() => setChecking(false));
  const checkRow = checking ? (
    <div className="pay-reject-confirm" role="group" aria-label="Did you receive the money?">
      <p className="proof-line pay-reject-title">Did you receive {m(bill.outside_cents ?? 0)}?</p>
      <p className="pay-final-line">This can&apos;t be undone here.</p>
      <div className="yes-no">
        <button type="button" className="verify-sign" disabled={busy !== null} onClick={receive}>
          {busy === "received" ? "Confirming…" : "Yes, received"}
        </button>
        <button type="button" className="quiet" disabled={busy !== null} onClick={() => setChecking(false)}>
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
        <WaiterSteps at={3} />
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
        {cancelRow ?? checkRow ?? (
          <div className="verify-actions" style={{ alignSelf: "stretch", marginTop: 12 }}>
            <button type="button" className="verify-reject" disabled={busy !== null || bill.state === "confirming"} onClick={() => setCancelling(true)}>
              Cancel
            </button>
            <button type="button" className="verify-sign" disabled={busy !== null} onClick={() => setChecking(true)}>
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
        <WaiterSteps at={3} />
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
              onClick={() => setEditing(true)}
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
  return (
    <BillEntry
      key={bill.state === "declined" ? `declined-${bill.version}` : "type"}
      start={bill.bill_cents ? { bill: bill.bill_cents, tip: bill.tip_cents } : undefined}
      busy={busy === "send"}
      error={error}
      top={
        <>
          {band}
          {reconnecting}
          {bill.state === "declined" ? (
            <p className="proof-status warn" role="status">
              The guest declined {m(total)}. Fix it and send again.
            </p>
          ) : null}
        </>
      }
      onSend={(billCents, tipCents) =>
        void run("send", (st) => sendBill(st, { bill_id: billId, version: bill.version, bill_cents: billCents, tip_cents: tipCents })).then((ok) => {
          if (ok) setEditing(false);
        })
      }
      onLeave={editing ? () => setEditing(false) : undefined}
    />
  );
}
