"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { clockTime, moneyLabel, readAmount } from "@mesita/place-profile/lib/money";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { billTab, cashTab, getTab, type StaffKey, type TabRead, type TabRefusal } from "@/lib/visit-api";
import { isStaffQrToken, keepStaff, readStaff } from "@/lib/staff-key";
import { GuestVerify } from "./GuestVerify";

// /tab/<token> — Pay at the table, the waiter's side (MESITA-3565). The
// guest shows a QR in the Mesita app; the waiter scans it and lands here. The
// QR token is the key to read the tab; sending the bill and Received need
// staff: the place code once per device, which the server answers with a
// 12-hour staff token kept in this device's localStorage (never the code).
//
// The screens follow the tab's status, read by a poll that carries the QR
// token only: Bill (bill, tip the waiter suggests after asking, optional
// ticket, "Send to guest"; a phone signed in by the Staff QR, MESITA-3696,
// skips the code) → Waiting for the guest (the bill may still
// change until the guest pays) → Collect the cash (when the guest chose to
// pay part in cash: one amount field, one Received) → Paid, a full green
// screen. Expired and Cancelled say so. Every rule and peso is the server's.
//
// Friends split the bill (MESITA-3695): once the guest splits it, the bill
// is locked and this screen lists each share ("Guest 2 · $500 · Paid"),
// what is left, and a Received for each share paid in cash (by the share's
// id, under this tab's token). Paid when the shares cover the bill.

// The poll is a setTimeout chain, never a websocket: every 1.5 s while the
// tab is moving, 5 s after 20 s with no change, 10 s after 2 min; any change
// brings it back to 1.5 s. Paused while the page is hidden.
const FAST_MS = 1500;
const MID_MS = 5000;
const SLOW_MS = 10_000;
function nextDelay(sinceChangeMs: number): number {
  if (sinceChangeMs < 20_000) return FAST_MS;
  if (sinceChangeMs < 120_000) return MID_MS;
  return SLOW_MS;
}

const DONE = ["paid", "expired", "cancelled"];

/** A tip box: empty or 0 is no tip. */
function readTip(text: string): number | null {
  const t = text.trim();
  if (t === "" || /^0+(\.0*)?$/.test(t)) return 0;
  return readAmount(t);
}

export default function TabPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [tab, setTab] = useState<TabRead | null>(null);
  const [gone, setGone] = useState(false);
  const [misses, setMisses] = useState(0);
  const [editing, setEditing] = useState(false);
  const [placeCode, setPlaceCode] = useState("");
  const [bill, setBill] = useState("");
  const [tip, setTip] = useState("");
  const [ticket, setTicket] = useState("");
  const [cash, setCash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped when the kept staff token changes, so the code field shows or hides.
  const [, setStaffBump] = useState(0);
  // When the tab last changed (0 until the first read): sets the poll's pace.
  const changedAt = useRef(0);
  const lastStamp = useRef<string | null>(null);

  const apply = useCallback((r: TabRead | "gone" | "failed") => {
    if (r === "failed") return setMisses((n) => n + 1);
    setMisses(0);
    if (r === "gone") return setGone(true);
    const stamp = `${r.status}|${r.updated_at}|${r.bill_version}`;
    if (stamp !== lastStamp.current || changedAt.current === 0) {
      lastStamp.current = stamp;
      changedAt.current = Date.now();
    }
    setTab(r);
  }, []);

  const refresh = useCallback(async () => apply(await getTab(token)), [apply, token]);

  // The poll: by the QR token only, until Paid, Expired, Cancelled or gone.
  const status = tab?.status ?? null;
  const stopped = gone || (status !== null && DONE.includes(status));
  useEffect(() => {
    if (stopped) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void tick(), ms);
    };
    const tick = async () => {
      timer = null;
      if (document.visibilityState !== "visible") return;
      const r = await getTab(token);
      if (!alive) return;
      apply(r);
      if (r === "gone" || (typeof r === "object" && DONE.includes(r.status))) return;
      schedule(nextDelay(Date.now() - changedAt.current));
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        if (timer) clearTimeout(timer);
        timer = null;
      } else if (!timer) {
        changedAt.current = Date.now();
        schedule(0);
      }
    };
    schedule(0);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, stopped, apply]);

  const placeId = tab?.place.id ?? null;
  const staffToken = placeId ? readStaff(placeId) : null;
  const code = placeCode.replace(/\s/g, "");
  const codeOk = staffToken !== null || /^\d{6}$/.test(code);
  const staffKey = (): StaffKey => (staffToken ? { staff_token: staffToken } : { place_code: code });

  function keep(minted: { staff_token: string | null; staff_expires_at: string | null }) {
    if (!placeId || !minted.staff_token) return;
    keepStaff(placeId, minted.staff_token, minted.staff_expires_at);
    setPlaceCode("");
    setStaffBump((n) => n + 1);
  }

  /** A refusal in plain words; a stale staff token sends the waiter back to the code. */
  function refused(r: TabRefusal) {
    if (r.code === "staff_qr_needed") {
      setError("Scan your Staff QR to confirm cash, then scan the guest's QR again.");
      return;
    }
    if (r.code === "staff_only" || r.code === "staff_key" || r.code === "place_code_required") {
      if (placeId) keepStaff(placeId, null, null);
      setStaffBump((n) => n + 1);
      setError(staffToken ? "Type the waiter code again." : r.error);
      return;
    }
    if (r.code === "locked" && typeof r.detail.retry_after_s === "number") {
      setError(`${r.error} Try again in ${Math.ceil(r.detail.retry_after_s / 60)} min.`);
      return;
    }
    if (r.code === "short" && typeof r.detail.missing_cents === "number" && tab) {
      setError(`${moneyLabel(r.detail.missing_cents, tab.currency)} missing. Collect it, then tap Received again.`);
      return;
    }
    setError(r.error);
  }

  const billCents = readAmount(bill);
  const tipCents = readTip(tip);
  const canSend = !!tab && billCents !== null && tipCents !== null && codeOk && !busy;
  const tipHigh = billCents !== null && tipCents !== null && tipCents > billCents / 2;

  async function send() {
    if (!tab || !canSend || billCents === null || tipCents === null) return;
    setBusy(true);
    setError(null);
    try {
      const r = await billTab({ token, bill_cents: billCents, tip_cents: tipCents, ticket: ticket.trim() || null, bill_version: tab.bill_version, ...staffKey() });
      if (r === "failed") return setError("Couldn't reach Mesita. Tap Send again.");
      if ("refused" in r) {
        // The code was right but the bill was refused (stale, paying): the
        // staff token it minted rides the refusal; keep it.
        if (typeof r.detail.staff_token === "string") {
          keep({ staff_token: r.detail.staff_token, staff_expires_at: typeof r.detail.staff_expires_at === "string" ? r.detail.staff_expires_at : null });
        }
        refused(r);
        if (r.code === "stale" || r.code === "paying") await refresh();
        return;
      }
      keep(r);
      setEditing(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const cashCents = cash.trim() === "" ? null : readAmount(cash);
  const cashOk = cash.trim() === "" || cashCents !== null;

  async function receive(shareTabId?: string) {
    if (!tab || busy || !cashOk || !codeOk) return;
    setBusy(true);
    setError(null);
    try {
      const r = await cashTab({ token, cash_received_cents: shareTabId ? null : cashCents, ...(shareTabId ? { share_tab_id: shareTabId } : {}), ...staffKey() });
      if (r === "failed") return setError("Couldn't reach Mesita. Tap Received again.");
      if ("refused" in r) {
        refused(r);
        if (r.code !== "short") await refresh();
        return;
      }
      keep(r);
      setCash("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function changeBill() {
    if (!tab) return;
    setBill(tab.bill_cents !== null ? String(tab.bill_cents / 100) : "");
    setTip(tab.tip_suggested_cents > 0 ? String(tab.tip_suggested_cents / 100) : "");
    setTicket(tab.ticket ?? "");
    setError(null);
    setEditing(true);
  }

  const band = tab?.test_mode ? (
    <p className="test-band" role="status" data-test-band>
      {TEST_BAND_TEXT}
    </p>
  ) : null;
  const reconnecting =
    misses >= 2 ? (
      <p className="proof-status" role="status" data-tab-state="reconnecting">
        Reconnecting…
      </p>
    ) : null;
  const alert = error ? (
    <p className="proof-status warn" role="alert">
      {error}
    </p>
  ) : null;
  const codeField =
    staffToken === null ? (
      <label className="field">
        Waiter code
        <input className="secret" inputMode="numeric" autoComplete="off" maxLength={7} value={placeCode} onChange={(e) => setPlaceCode(e.target.value)} />
        {/* MESITA-3696: the Staff QR signs the phone in for the shift. */}
        <span className="field-hint" data-staff-qr-hint>
          Or scan the Staff QR the owner printed, then scan the guest’s QR again.
        </span>
      </label>
    ) : null;

  if (gone) {
    return (
      <main className="proof" data-tab-state="gone">
        <p className="proof-status warn" role="alert">
          This tab is gone. Ask the guest to show the QR again.
        </p>
      </main>
    );
  }

  if (!tab) {
    return (
      <main className="proof" data-tab-state="loading">
        {reconnecting}
        <p className="proof-line" role="status">
          Opening the tab…
        </p>
      </main>
    );
  }

  // MESITA-3708: a guest's own payment ends with the waiter's Verify.
  if (tab.origin === "guest") {
    return <GuestVerify token={token} tab={tab} band={band} reconnecting={reconnecting} onChanged={refresh} />;
  }

  const place = <p className="proof-place">{tab.place.name ?? "A Mesita place"}</p>;
  const ticketLine = tab.ticket ? <p className="proof-line">Ticket {tab.ticket}</p> : null;

  if (tab.status === "paid") {
    const split = tab.table;
    const sharesTip = split ? split.shares.reduce((n, s) => n + (s.status === "paid" ? s.tip_cents : 0), 0) : 0;
    const total = split
      ? split.paid_cents + sharesTip
      : tab.credit_cents + tab.cash_bill_cents + tab.cash_tip_cents + tab.card_bill_cents + tab.card_tip_cents || (tab.bill_cents ?? 0);
    const tipPaid = split ? sharesTip : tab.cash_tip_cents + tab.card_tip_cents;
    return (
      <main className="tab-paid" data-tab-state="paid">
        {band}
        <span className="tab-paid-tick" aria-hidden>
          ✓
        </span>
        <p className="tab-paid-title" role="status">
          Paid
        </p>
        <p className="tab-paid-amount">{moneyLabel(total, tab.currency)}</p>
        {tipPaid > 0 ? <p className="tab-paid-line">Includes {moneyLabel(tipPaid, tab.currency)} tip</p> : null}
        {split ? <p className="tab-paid-line">Split between {split.shares.filter((s) => s.status === "paid").length}</p> : null}
        {tab.paid_at ? <p className="tab-paid-line">{clockTime(tab.paid_at)}</p> : null}
        {tab.ticket ? <p className="tab-paid-line">Ticket {tab.ticket}</p> : null}
        <p className="tab-paid-line">{tab.place.name ?? "A Mesita place"}</p>
      </main>
    );
  }

  if (tab.status === "expired" || tab.status === "cancelled") {
    return (
      <main className="proof" data-tab-state={tab.status}>
        {band}
        <p className="proof-status warn" role="alert">
          {tab.status === "expired" ? "This tab expired. Ask the guest to open a new one in the Mesita app." : "The guest cancelled this tab."}
        </p>
        {tab.table && tab.table.paid_cents > 0 ? (
          <p className="proof-line" data-split-part-paid>
            Paid on Mesita {moneyLabel(tab.table.paid_cents, tab.currency)} of {moneyLabel(tab.table.bill_cents, tab.currency)} · collect{" "}
            {moneyLabel(tab.table.bill_cents - tab.table.paid_cents, tab.currency)} directly
          </p>
        ) : null}
        {place}
      </main>
    );
  }

  if (tab.status === "paying") {
    const due = tab.cash_due_cents;
    if (due > 0 && tab.cash_received_cents === null) {
      return (
        <main className="proof" data-tab-state="collect">
          {band}
          {isStaffQrToken(staffToken) ? null : (
            <p className="staff-qr-banner" role="status">
              Scan your Staff QR
            </p>
          )}
          {reconnecting}
          <p className="proof-line" role="status">
            The guest pays part in cash
          </p>
          <p className="proof-amount">Collect {moneyLabel(due, tab.currency)}</p>
          <p className="proof-line">
            {moneyLabel(tab.cash_bill_cents, tab.currency)} bill
            {tab.cash_tip_cents > 0 ? ` · ${moneyLabel(tab.cash_tip_cents, tab.currency)} tip` : ""}
          </p>
          {tab.credit_cents > 0 ? <p className="proof-line">{moneyLabel(tab.credit_cents, tab.currency)} paid from credit</p> : null}
          {tab.card_bill_cents + tab.card_tip_cents > 0 ? (
            <p className="proof-line">{moneyLabel(tab.card_bill_cents + tab.card_tip_cents, tab.currency)} by card</p>
          ) : null}
          {ticketLine}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void receive();
            }}
            style={{ alignSelf: "stretch" }}
          >
            {codeField}
            <label className="field">
              Cash received
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder={`Empty means exactly ${moneyLabel(due, tab.currency)}`}
                value={cash}
                onChange={(e) => setCash(e.target.value)}
              />
            </label>
            {alert}
            <button type="submit" disabled={busy || !cashOk || !codeOk} style={{ minHeight: 56 }}>
              {busy ? "Confirming…" : "Received"}
            </button>
          </form>
          {place}
        </main>
      );
    }
    return (
      <main className="proof" data-tab-state="paying">
        {band}
        {reconnecting}
        <p className="proof-line" role="status">
          The guest is paying
        </p>
        <p className="proof-amount">{moneyLabel(tab.bill_cents ?? 0, tab.currency)}</p>
        {ticketLine}
        {alert}
        {place}
      </main>
    );
  }

  if (tab.status === "billed" && tab.table) {
    const split = tab.table;
    return (
      <main className="proof" data-tab-state="split">
        {band}
        {reconnecting}
        <p className="proof-line" role="status">
          Friends are splitting the bill
        </p>
        <p className="proof-amount">{moneyLabel(split.left_cents, tab.currency)} left</p>
        <p className="proof-line">
          of {moneyLabel(split.bill_cents, tab.currency)} · paid {moneyLabel(split.paid_cents, tab.currency)}
        </p>
        {ticketLine}
        <ul className="split-shares">
          {split.shares.map((s, i) => {
            const collect = s.status === "paying" && s.cash_due_cents > 0 && s.cash_received_cents === null;
            return (
              <li key={s.id} className="split-share" data-share-status={s.status}>
                <span>
                  Guest {i + 1} · {moneyLabel(s.share_cents, tab.currency)}
                  {s.tip_cents > 0 && s.status !== "billed" ? ` + ${moneyLabel(s.tip_cents, tab.currency)} tip` : ""}
                </span>
                {collect ? (
                  <button type="button" disabled={busy || !codeOk} onClick={() => void receive(s.id)}>
                    {busy ? "Confirming…" : `Received ${moneyLabel(s.cash_due_cents, tab.currency)}`}
                  </button>
                ) : (
                  <span className="split-share-status">{s.status === "paid" ? "Paid" : s.status === "paying" ? "Paying" : "Choosing"}</span>
                )}
              </li>
            );
          })}
        </ul>
        {split.shares.some((s) => s.status === "paying" && s.cash_due_cents > 0 && s.cash_received_cents === null) ? codeField : null}
        {alert}
        <p className="proof-line proof-clock">Open until {clockTime(tab.expires_at)}</p>
        {place}
      </main>
    );
  }

  if (tab.status === "billed" && !editing) {
    return (
      <main className="proof" data-tab-state="billed">
        {band}
        {reconnecting}
        <p className="proof-line" role="status">
          Waiting for the guest
        </p>
        <p className="proof-amount">{moneyLabel(tab.bill_cents ?? 0, tab.currency)}</p>
        {tab.tip_suggested_cents > 0 ? <p className="proof-line">{moneyLabel(tab.tip_suggested_cents, tab.currency)} tip suggested · the guest decides</p> : null}
        {ticketLine}
        <p className="proof-line proof-clock">Open until {clockTime(tab.expires_at)}</p>
        {alert}
        {place}
        <div className="proof-foot">
          <button type="button" className="quiet" onClick={changeBill}>
            Change the bill
          </button>
        </div>
      </main>
    );
  }

  // waiting_bill, or changing a bill already sent.
  return (
    <main className="proof" data-tab-state="bill">
      {band}
      {reconnecting}
      <h1>{editing ? "Change the bill" : "Send the bill"}</h1>
      <p>The guest sees it on Mesita and chooses how to pay.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        style={{ alignSelf: "stretch" }}
      >
        {codeField}
        <label className="field">
          Bill
          <input inputMode="decimal" autoComplete="off" placeholder="0" value={bill} onChange={(e) => setBill(e.target.value)} />
        </label>
        <label className="field">
          Tip (ask the guest)
          <input inputMode="decimal" autoComplete="off" placeholder="Leave empty and the guest chooses" value={tip} onChange={(e) => setTip(e.target.value)} />
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
        {alert}
        <button type="submit" disabled={!canSend}>
          {busy ? "Sending…" : "Send to guest"}
        </button>
        {editing ? (
          <button type="button" className="quiet" onClick={() => setEditing(false)}>
            Keep the bill as it is
          </button>
        ) : null}
      </form>
      {place}
    </main>
  );
}
