"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { BillEntry, CodeEntry, GuestCheck } from "@/components/BillEntry";
import { closeBill, getBill, keepBillStaff, openBill, sendBill, signIn, type Staff, typeBill, type Typing } from "@/lib/bill-api";

// /pay/<token> — the waiter scanned a guest's Mesita QR: Bill, Tip, then Code
// (MESITA-4879): their own 8 digits, which name the place and the waiter, then
// whose QR it is, and Send bill. Nothing about the phone is kept.

type Found = { billId: string; staff: Staff; version: number; currency: string; name: string | null; photo: string | null; age: number | null; sex: "female" | "male" | null };
type Typed = { bill: number; tip: number };

export default function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [typed, setTyped] = useState<Typed | null>(null);
  const [view, setView] = useState<"type" | "code" | "guest" | "ended">("type");
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState<"code" | "send" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // THE GUEST WATCHES IT BEING TYPED (MESITA-4887): every 250 ms when it
  // changed, every five while it did not, one call at a time.
  const typing = useRef<Typing>({ bill_cents: 0, tip_cents: 0, step: "bill" });
  const onTyping = useCallback((bill_cents: number, tip_cents: number, step: "bill" | "tip") => {
    typing.current = { bill_cents, tip_cents, step };
  }, []);
  const live = view !== "ended";
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
    router.replace(`/bill/${billId}`);
  };
  const say = (r: "failed" | { error: string }) => {
    setError(r === "failed" ? "Couldn't reach Mesita. Tap again." : r.error);
    setBusy(null);
  };

  async function enter(code: string | null): Promise<boolean> {
    if (busy) return false;
    setBusy("code");
    setError(null);
    const fail = (r: "failed" | { error: string }) => {
      say(r);
      // Only a refused code is typed again.
      return r === "failed" || !("code" in r) || r.code !== "staff_only";
    };
    const key = await signIn(code, { token });
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
    // The guest already accepted a bill here: that one is collected first.
    if (now.bill.state === "accepted" || now.bill.state === "confirming") {
      go(opened.bill_id, staff);
      return true;
    }
    // A rescan finds the same bill, maybe already sent: send over its version.
    setFound({ billId: opened.bill_id, staff, version: now.bill.version, currency: now.bill.currency, name: now.guest_name ?? null, photo: now.guest_photo, age: now.guest_age ?? null, sex: now.guest_sex ?? null });
    setView("guest");
    return true;
  }

  async function send() {
    if (!found || !typed || busy) return;
    setBusy("send");
    setError(null);
    const r = await sendBill(found.staff, { bill_id: found.billId, version: found.version, bill_cents: typed.bill, tip_cents: typed.tip });
    if (r === "failed") return say(r);
    if ("refused" in r) {
      // Accepted or changed on another phone: the bill's own screen says it.
      if (r.code === "accepted" || r.code === "stale") return go(found.billId, found.staff);
      return say(r);
    }
    go(found.billId, found.staff);
  }

  async function no() {
    if (!found || busy) return;
    setBusy("no");
    setError(null);
    const r = await closeBill(found.staff, found.billId, "cancel");
    if (r === "failed") return say(r);
    setBusy(null);
    setView("ended");
  }

  if (view === "ended") {
    return (
      <main className="proof pay-end" data-scan="ended">
        <h1>Nothing was sent</h1>
        <p className="proof-line">Scan your guest&apos;s QR.</p>
      </main>
    );
  }
  if (view === "guest" && found && typed) {
    return (
      <GuestCheck
        name={found.name}
        photo={found.photo}
        age={found.age}
        sex={found.sex}
        total={moneyLabel(typed.bill + typed.tip, found.currency)}
        busy={busy === "code" ? null : busy}
        error={error}
        onSend={() => void send()}
        onNo={() => void no()}
      />
    );
  }
  if (view === "code") {
    return (
      <CodeEntry
        label="Next"
        busy={busy === "code"}
        error={error}
        onCode={enter}
        onBack={() => {
          setError(null);
          setView("type");
        }}
      />
    );
  }
  return (
    <BillEntry
      start={typed ?? undefined}
      atTip={typed !== null}
      sendLabel="Next"
      onTyping={onTyping}
      busy={busy === "code"}
      error={error}
      onSend={(bill, tip) => {
        setTyped({ bill, tip });
        typing.current = { bill_cents: bill, tip_cents: tip, step: "code" };
        // A place with codes off goes straight to the guest (MESITA-4890).
        void enter(null);
      }}
    />
  );
}
