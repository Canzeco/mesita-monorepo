"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { CodeEntry, GuestCheck } from "@/components/BillEntry";
import { closeBill, getBill, keepBillStaff, openBill, signIn, type Staff } from "@/lib/bill-api";

// /pay/<token> — the waiter scanned a guest's Mesita QR. STEP 1, SCAN
// (MESITA-4878): their own 8-digit code, which names the place and the waiter,
// then whose QR it is (photo and first name). Yes opens the bill; No closes it.
// Nothing about the phone is kept.

type Found = { billId: string; staff: Staff; name: string | null; photo: string | null };

export default function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [found, setFound] = useState<Found | null>(null);
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (f: Found) => {
    keepBillStaff(f.billId, f.staff);
    router.replace(`/bill/${f.billId}`);
  };

  async function enter(code: string): Promise<boolean> {
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
    const staff: Staff = { place_id: key.place.id, staff_token: key.staff_token, waiter: key.waiter?.name ?? null };
    const opened = await openBill(staff, { token });
    if (opened === "failed" || "refused" in opened) return fail(opened);
    const now = await getBill(staff, opened.bill_id);
    if (now === "failed" || "refused" in now) return fail(now);
    const f: Found = { billId: opened.bill_id, staff, name: now.guest_name ?? null, photo: now.guest_photo };
    setBusy(false);
    // A rescan of a bill already sent or accepted: that one goes on.
    if (now.bill.state !== "open") open(f);
    else setFound(f);
    return true;
  }

  async function no() {
    if (!found || busy) return;
    setBusy(true);
    setError(null);
    const r = await closeBill(found.staff, found.billId, "cancel");
    setBusy(false);
    if (r === "failed") return setError("Couldn't reach Mesita. Tap again.");
    setEnded(true);
  }

  if (ended) {
    return (
      <main className="proof pay-end" data-scan="ended">
        <h1>Nothing was sent</h1>
        <p className="proof-line">Scan your guest&apos;s QR.</p>
      </main>
    );
  }
  if (found) return <GuestCheck name={found.name} photo={found.photo} busy={busy} error={error} onYes={() => open(found)} onNo={() => void no()} />;
  return <CodeEntry label="Continue" busy={busy} error={error} onCode={enter} />;
}
