"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { closeBill, getBill, keepBillStaff, openBill, readBillStaff, receiveBill, sendBill, unreceiveBill, signIn as checkCode, type BillRead, type BillState, type Refused, type Staff } from "@/lib/bill-api";
import { BillEntry, CodeEntry, WaiterSteps } from "@/components/BillEntry";
import { Bones } from "@/components/Bones";
import { UserIcon, XIcon } from "@/app/tab/[token]/icons";

// THE WAITER'S BILL (MESITA-4823), by its state:
//
// The waiter's Confirm and Receipt, and Bill and Tip again on an edit (MESITA-4879):
//
//   open       Bill and Tip, Send bill
//   sent       Guest paid me $X, Edit, Cancel; once tapped, waiting for the guest, Undo
//   declined   the same boxes, "The guest declined"
//   accepted   the guest already paid on their phone: Receive $X closes it
//   paid       the green screen, Next guest
//   cancelled, expired   why, Send again
//
// The tip is never picked for the guest: None until the waiter asks. The
// waiter never reads the guest's name or balance. Every peso is the server's.

const DONE: BillState[] = ["paid", "cancelled", "expired"];
/** Every second while it moves, 5 s after 30 s still, 10 s after 3 min. */
function nextDelay(stillMs: number): number {
  if (stillMs < 30_000) return 1000;
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
  const reads = useRef(0);
  const [finished, setFinished] = useState(false);
  // A bill that just changed is not received by a tap already on its way.
  const [armedAt, setArmedAt] = useState(0);
  const [now, setNow] = useState(0);
  // The itemized bill stays behind Why until the waiter asks (MESITA-4955),
  // and Why is a modal over the whole page (MESITA-4962).
  const [why, setWhy] = useState(false);
  const whyClose = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!why) return;
    whyClose.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWhy(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [why]);
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
    const n = ++reads.current;
    const r = await getBill(s, billId);
    // A newer read is on its way: this one is old.
    if (n !== reads.current) return;
    if (r === "failed") return setMisses((x) => x + 1);
    if ("refused" in r) {
      if (r.code === "staff_code_needed") return signIn();
      return setGone(true);
    }
    setMisses(0);
    const next = `${r.bill.state}:${r.bill.version}:${r.bill.waiter_ready === true}`;
    if (next !== stamp.current) {
      stamp.current = next;
      changedAt.current = Date.now();
      setArmedAt(Date.now() + 1000);
      setTimeout(() => setNow(Date.now()), 1050);
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
      if (alive) timer = setTimeout(() => void loop(), nextDelay(changedAt.current === 0 ? 0 : Date.now() - changedAt.current));
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

  const [named, setNamed] = useState(false);
  const [askName, setAskName] = useState(false);
  async function unlock(code: string, name: string | null = null): Promise<boolean> {
    if (busy) return false;
    setBusy("code");
    setError(null);
    const r = await checkCode(code, { bill_id: billId }, name);
    setBusy(null);
    if (r !== "failed" && "refused" in r) {
      if (r.name_required) setNamed(true);
      if (r.code === "name_needed" && !name) {
        setAskName(true);
        return true;
      }
      // Refused: the code is typed again.
      setAskName(false);
    }
    if (r !== "failed" && "refused" in r && r.code === "ticket_closed") {
      setGone(true);
      setLocked(false);
      return true;
    }
    if (r === "failed" || "refused" in r) {
      setError(r === "failed" ? "Couldn't reach Mesita. Tap again." : r.error);
      return r === "failed";
    }
    keepBillStaff(billId, { place_id: r.place.id, staff_token: r.staff_token, waiter: r.waiter?.name ?? null });
    setAskName(false);
    setLocked(false);
    return true;
  }

  if (locked) return (
    <CodeEntry
      label="Open bill"
      named={named}
      askName={askName}
      busy={busy === "code"}
      error={error}
      onCode={unlock}
      onBack={() => {
        setError(null);
        setAskName(false);
      }}
    />
  );
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
  // ONE TICKET (Pato, 2026-11-24, MESITA-4886: "better design in those"), the
  // guest's own: a solid top with who and how much, its lines under it.
  const ticket = (tone: "ink" | "green", words: React.ReactNode, amount: string, lines: { label: string; value: string; good?: boolean }[]) => (
    <section className="tk">
      <div className={`tk-top${tone === "green" ? " tk-green" : ""}`}>
        <div className="tk-who">
          <span className="tk-photo" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo} alt="" /> : <UserIcon className="pay-icon" />}
          </span>
          <span className="tk-names">
            <b>{guestName ?? "Guest"}</b>
            <span>{placeName}</span>
          </span>
        </div>
        <p className="tk-words" role="status">
          {words}
        </p>
        <p className="tk-amount">{amount}</p>
      </div>
      <ul className="tk-lines">
        {lines.map((l) => (
          <li key={l.label} className={l.good ? "tk-good" : undefined}>
            <span>{l.label}</span>
            <b>{l.value}</b>
          </li>
        ))}
      </ul>
    </section>
  );
  const dots = (
    <span className="tk-dots" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
  const took = bill.took_cents ?? null;
  const billLine = { label: "Bill", value: m(bill.bill_cents ?? 0) };
  const tipLine = bill.tip_cents > 0 ? [{ label: "Tip", value: m(bill.tip_cents) }] : [];
  const offLines = [
    ...(bill.credit_cents > 0 ? [{ label: "Paid with credits", value: `−${m(bill.credit_cents)}`, good: true }] : []),
  ];
  const detailLines: { label: string; value: string; good?: boolean }[] = [billLine, ...offLines, ...tipLine];
  const sendAgain = () =>
    run("again", async (s) => {
      const r = await openBill(s, { again_bill_id: billId });
      if (r !== "failed" && !("refused" in r)) {
        keepBillStaff(r.bill_id, s);
        router.replace(`/bill/${r.bill_id}`);
      }
      return r;
    });

  // DONE (Pato, MESITA-4890: "after all done, enable to close"). A browser closes
  // only a page it opened from another: where it won't, this says so.
  if (bill.state === "paid" && finished) {
    return (
      <main className="proof pay-end" data-bill="done">
        <h1>All done</h1>
        <p className="proof-line">You can close this page. For another guest, scan their QR.</p>
      </main>
    );
  }

  // PAID.
  if (bill.state === "paid") {
    const collected = bill.outside_cents ?? 0;
    // RECEIPT.
    return (
      <main className="wp" data-bill="paid">
        <WaiterSteps at="Receipt" named={waiter !== null} />
        {band}
        {ticket("green", "Paid", m(collected), [
          ...detailLines,
          ...(waiter ? [{ label: "Waiter", value: waiter }] : []),
        ])}
        {/* Friends who split: each shows their own QR. */}
        <p className="wp-line wp-center">Another guest? Scan their QR.</p>
        <div className="wp-space" />
        <button
          type="button"
          className="wp-go"
          onClick={() => {
            keepBillStaff(billId, null);
            setFinished(true);
            window.close();
          }}
        >
          Done
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
          {took !== null && took > 0
            ? `You took ${m(took)} and no credits were used. Give it back${took < total ? `, or collect ${m(total - took)} more` : ""}.`
            : bill.bill_cents ? `${m(total)}. No credits were used. Send it again if the guest still wants Mesita.` : "Nothing was sent."}
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
      {bill.state === "accepted" || took !== null ? <p className="pay-final-line">No credits are used. Give back any money the guest already paid.</p> : null}
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

  // THE HANDSHAKE (Pato, 2026-11-24, MESITA-4889: "a screen that waits for both
  // sides to confirm, not sequential order, but just both sides to coincide").
  // The other person's tap is the second check: nothing is asked twice.
  if ((bill.state === "sent" && !editing) || bill.state === "accepted" || bill.state === "confirming") {
    const due = bill.outside_cents ?? 0;
    const guest = guestName ?? "The guest";
    const guestReady = bill.state !== "sent";
    const ready = bill.waiter_ready === true || bill.state === "confirming";
    const changed = took !== null && !ready && took !== due;
    const side = (who: string, on: boolean) => (
      <span className={`hs-side${on ? " hs-on" : ""}`} data-ready={on}>
        <i aria-hidden>{on ? "✓" : "…"}</i>
        <b>{who}</b>
        <span>{on ? "Ready" : "Waiting"}</span>
      </span>
    );
    const waiting = ready && !guestReady;
    return (
      <main className="wp" data-bill="handshake" data-ready={ready}>
        <WaiterSteps at="Payment" named={waiter !== null} />
        {band}
        {reconnecting}
        <section className="tk tk-open" data-pay-amount>
          <div className="tk-who">
            <span className="tk-photo" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo ? <img src={photo} alt="" /> : <UserIcon className="pay-icon" />}
            </span>
            <span className="tk-names">
              <b>{guestName ?? "Guest"}</b>
              <span>{placeName}</span>
            </span>
          </div>
          <p className="tk-say" role="status">
            {waiting ? <>Waiting for {guest} {dots}</> : due > 0 ? "Collect this, cash or card" : "Nothing to collect"}
          </p>
          <div className="tk-box">
            <p className="tk-amount">{m(due)}</p>
          </div>
          <button type="button" className="tk-why" aria-haspopup="dialog" onClick={() => setWhy(true)}>
            Why?
          </button>
          {why
            ? createPortal(
                <div className="why-modal" role="dialog" aria-modal="true" aria-label="Why?">
                  <button type="button" className="why-back" aria-label="Close" onClick={() => setWhy(false)} />
                  <div className="why-card">
                    <div className="why-head">
                      <h2>Why?</h2>
                      <button ref={whyClose} type="button" className="why-x" aria-label="Close" onClick={() => setWhy(false)}>
                        <XIcon className="pay-icon" />
                      </button>
                    </div>
                    <ul className="tk-lines">
                      {detailLines.map((l) => (
                        <li key={l.label} className={l.good ? "tk-good" : undefined}>
                          <span>{l.label}</span>
                          <b>{l.value}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>,
                document.body,
              )
            : null}
        </section>
        <div className="hs" role="status">
          {side("You", ready)}
          <span className={`hs-line${ready || guestReady ? " hs-on" : ""}`} aria-hidden />
          {side(guest, guestReady)}
        </div>
        {changed ? (
          <p className="proof-status warn" role="status">
            The bill changed. You took {m(took)}; now it is {m(due)}.
          </p>
        ) : null}
        {alert}
        <div className="wp-space" />
        {waiting ? <p className="wp-line wp-center hs-warn">Not done yet. Don&apos;t let {guest} leave until they tap I paid.</p> : null}
        {cancelRow ??
          (waiting ? (
            <div className="wp-actions wp-half">
              <button type="button" className="wp-no" disabled={busy !== null} onClick={() => setCancelling(true)}>
                Cancel
              </button>
              <button type="button" className="wp-no" disabled={busy !== null} onClick={() => void run("undo", (s) => unreceiveBill(s, billId))}>
                {busy === "undo" ? "Undoing…" : "Undo"}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="wp-go wp-yes hs-go"
                disabled={busy !== null || ready || now < armedAt}
                onClick={() => void run("receive", (s) => receiveBill(s, billId, bill.version))}
              >
                {busy === "receive" || bill.state === "confirming" ? "Confirming…" : due > 0 ? `Guest paid me ${m(due)}` : "Confirm"}
              </button>
              <div className={guestReady ? "" : "wp-actions wp-half"}>
                <button type="button" className="wp-no" disabled={busy !== null || bill.state === "confirming"} onClick={() => setCancelling(true)}>
                  Cancel
                </button>
                {guestReady ? null : (
                  <button type="button" className="wp-no" disabled={busy !== null} onClick={() => {
                    setError(null);
                    setEditing(true);
                  }}>
                    Edit
                  </button>
                )}
              </div>
            </>
          ))}
      </main>
    );
  }

  // TYPE THE BILL: open, declined, or an edit.
  return (
    <BillEntry
      named={waiter !== null}
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
              {took !== null && took > 0 ? ` You took ${m(took)}: give it back or collect the difference.` : ""}
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
