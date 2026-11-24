"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BillEntry, CodeEntry, GuestCheck } from "@/components/BillEntry";
import { Bones } from "@/components/Bones";
import { closeBill, getBill, keepBillDraft, keepBillStaff, openBill, readBillDraft, sendBill, signIn, type Staff, typeBill, type Typing } from "@/lib/bill-api";

// /pay/<token> — the waiter scanned a guest's Mesita QR: the Code first
// (MESITA-4916): the place's 6 digits (MESITA-4904), then whose QR it is; then
// Bill, Tip and Send bill. Nothing about the phone is kept.

type Found = { billId: string; staff: Staff; version: number; name: string | null; photo: string | null; age: number | null; sex: "female" | "male" | null };

export default function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [start, setStart] = useState<{ bill: number; tip: number } | undefined>();
  const [view, setView] = useState<"start" | "code" | "guest" | "type" | "ended" | "closed">("start");
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState<"code" | "send" | "no" | null>(null);
  const [askName, setAskName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // THE GUEST WATCHES IT BEING TYPED (MESITA-4887): every 250 ms when it
  // changed, every five while it did not, one call at a time.
  const typing = useRef<Typing>({ bill_cents: 0, tip_cents: 0, step: "code" });
  const onTyping = useCallback((bill_cents: number, tip_cents: number, step: "bill" | "tip") => {
    typing.current = { bill_cents, tip_cents, step };
  }, []);
  const billId = found?.billId ?? null;
  const onType = useCallback((bill: number, tip: number, step: "bill" | "tip") => {
    onTyping(bill, tip, step);
    if (billId && bill > 0) keepBillDraft(billId, { bill, tip });
  }, [billId, onTyping]);
  useEffect(() => {
    if (view === "code") typing.current = { bill_cents: 0, tip_cents: 0, step: "code" };
    if (view === "guest") typing.current = { bill_cents: 0, tip_cents: 0, step: "bill" };
  }, [view]);
  const live = view === "code" || view === "guest" || view === "type";
  useEffect(() => {
    if (!live) return;
    let sent = "";
    let at = 0;
    let out = false;
    const tick = () => {
      const now = JSON.stringify(typing.current);
      if (out || document.visibilityState !== "visible" || (now === sent && Date.now() - at < 5000)) return;
      out = true;
      sent = now;
      at = Date.now();
      void typeBill(token, typing.current).finally(() => {
        out = false;
      });
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [live, token]);

  const go = (billId: string, staff: Staff) => {
    keepBillStaff(billId, staff);
    keepBillDraft(billId, null);
    router.replace(`/bill/${billId}`);
  };
  const say = (r: "failed" | { error: string }) => {
    setError(r === "failed" ? "Couldn't reach Mesita. Tap again." : r.error);
    setBusy(null);
  };

  async function enter(code: string | null, name: string | null = null): Promise<boolean> {
    if (busy) return false;
    setBusy("code");
    setError(null);
    const fail = (r: "failed" | { error: string }) => {
      if (r !== "failed" && "code" in r && r.code === "ticket_closed") {
        setBusy(null);
        setView("closed");
        return true;
      }
      say(r);
      // Only a refused code is typed again.
      return r === "failed" || !("code" in r) || r.code !== "staff_only";
    };
    const key = await signIn(code, { token }, name);
    if (key !== "failed" && "refused" in key && key.name_required) setAskName(true);
    if (code === null && key !== "failed" && "refused" in key && key.code === "code_needed") {
      setBusy(null);
      setView("code");
      return false;
    }
    if (key === "failed" || "refused" in key) return fail(key);
    const staff: Staff = { place_id: key.place.id, staff_token: key.staff_token, waiter: key.waiter?.name ?? null };
    const opened = await openBill(staff, { token });
    if (opened === "failed" || "refused" in opened) return fail(opened);
    const now = await getBill(staff, opened.bill_id);
    if (now === "failed" || "refused" in now) return fail(now);
    setBusy(null);
    // A bill already sent, accepted or over: its own screen, never typed again.
    if (now.bill.state !== "open") {
      go(opened.bill_id, staff);
      return true;
    }
    setFound({ billId: opened.bill_id, staff, version: now.bill.version, name: now.guest_name ?? null, photo: now.guest_photo, age: now.guest_age ?? null, sex: now.guest_sex ?? null });
    setView("guest");
    return true;
  }

  // A place with codes off opens by itself (MESITA-4890); the keypad shows only
  // where a code is needed, never because a call was lost.
  const began = useRef(false);
  useEffect(() => {
    if (began.current) return;
    began.current = true;
    const id = setTimeout(() => void enter(null), 0);
    return () => {
      began.current = false;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(bill: number, tip: number) {
    if (!found || busy) return;
    setBusy("send");
    setError(null);
    const bill_tip = { bill_cents: bill, tip_cents: tip };
    let at = found;
    let r = await sendBill(at.staff, { bill_id: at.billId, version: at.version, ...bill_tip });
    // Typed past its 15 minutes: a new one, sent once. A cancelled one stays so.
    if (r !== "failed" && "refused" in r && r.code === "expired") {
      const old = await getBill(at.staff, at.billId);
      if (old !== "failed" && !("refused" in old) && old.bill.state === "expired") {
        const next = await openBill(at.staff, { again_bill_id: at.billId });
        const now = next === "failed" || "refused" in next ? next : await getBill(at.staff, next.bill_id);
        if (now === "failed" || "refused" in now) return say(now);
        at = { ...at, billId: now.bill.id, version: now.bill.version };
        if (now.bill.state !== "open") return go(at.billId, at.staff);
        setFound(at);
        r = await sendBill(at.staff, { bill_id: at.billId, version: at.version, ...bill_tip });
      }
    }
    if (r === "failed") return say(r);
    if ("refused" in r) {
      // Accepted, changed or over, or the code is needed again: the bill's own
      // screen says it.
      if (["accepted", "stale", "expired", "gone", "staff_code_needed"].includes(r.code)) return go(at.billId, at.staff);
      return say(r);
    }
    go(at.billId, at.staff);
  }

  async function no() {
    if (!found || busy) return;
    setBusy("no");
    setError(null);
    const r = await closeBill(found.staff, found.billId, "cancel");
    if (r === "failed") return say(r);
    // Not cancelled (already paid, or over): the bill's own screen says which.
    if ("refused" in r) return go(found.billId, found.staff);
    setBusy(null);
    setView("ended");
  }

  // THREE WRONG CODES (Pato, MESITA-4898: "terminate the ticket due to many
  // failed attempts").
  if (view === "closed") {
    return (
      <main className="proof pay-end" data-scan="closed">
        <h1>Ticket closed</h1>
        <p className="proof-line">Too many wrong codes. Ask the guest for a new QR and scan it.</p>
      </main>
    );
  }
  if (view === "ended") {
    return (
      <main className="proof pay-end" data-scan="ended">
        <h1>Nothing was sent</h1>
        <p className="proof-line">Scan your guest&apos;s QR.</p>
      </main>
    );
  }
  if (view === "start") {
    return (
      <main className="proof" data-scan="start">
        {error ? (
          <>
            <p className="proof-status warn" role="alert">
              {error}
            </p>
            <button type="button" style={{ marginTop: 16, alignSelf: "stretch" }} disabled={busy !== null} onClick={() => void enter(null)}>
              Try again
            </button>
          </>
        ) : (
          <Bones label="Opening the bill" />
        )}
      </main>
    );
  }
  if (view === "guest" && found) {
    return (
      <GuestCheck
        name={found.name}
        photo={found.photo}
        age={found.age}
        sex={found.sex}
        busy={busy === "no"}
        error={error}
        onYes={() => {
          setError(null);
          setStart(readBillDraft(found.billId));
          setView("type");
        }}
        onNo={() => void no()}
      />
    );
  }
  if (view === "code") {
    return (
      <CodeEntry
        label="Next"
        askName={askName}
        busy={busy === "code"}
        error={error}
        onCode={enter}
      />
    );
  }
  return (
    <BillEntry
      start={start}
      onTyping={onType}
      busy={busy === "send"}
      error={error}
      onSend={(bill, tip) => void send(bill, tip)}
    />
  );
}
