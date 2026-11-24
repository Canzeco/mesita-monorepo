"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { BillEntry } from "@/components/BillEntry";
import { getBill, keepBillStaff, openBill, sendBill, signIn, type Staff } from "@/lib/bill-api";

// /pay/<token> — the waiter scanned a guest's Mesita QR: the bill, the tip,
// their own 8-digit code, Send (MESITA-4871). The code names the place and the
// waiter; nothing about the phone is kept.

export default function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(billCents: number, tipCents: number, code: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const fail = (r: "failed" | { error: string }) => {
      setError(r === "failed" ? "Couldn't reach Mesita. Tap again." : r.error);
      setBusy(false);
      // Only a refused code is typed again.
      return r === "failed" || !("code" in r) || r.code !== "staff_only";
    };
    const key = await signIn(code, { token });
    if (key === "failed" || "refused" in key) return fail(key);
    const staff: Staff = { place_id: key.place.id, staff_token: key.staff_token };
    const opened = await openBill(staff, { token });
    if (opened === "failed" || "refused" in opened) return fail(opened);
    // A rescan finds the same bill, maybe already sent: send over its version.
    const now = await getBill(staff, opened.bill_id);
    if (now === "failed" || "refused" in now) return fail(now);
    // The guest already accepted a bill here: that one is collected first.
    if (now.bill.state !== "accepted" && now.bill.state !== "confirming") {
      const sent = await sendBill(staff, { bill_id: opened.bill_id, version: now.bill.version, bill_cents: billCents, tip_cents: tipCents });
      if (sent === "failed" || "refused" in sent) return fail(sent);
    }
    keepBillStaff(opened.bill_id, staff);
    router.replace(`/bill/${opened.bill_id}`);
    return true;
  }

  return <BillEntry withCode busy={busy} error={error} onSend={send} />;
}
