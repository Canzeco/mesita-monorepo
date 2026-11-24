"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { readAmount } from "@mesita/place-profile/lib/money";
import { getBill, keepBillStaff, openBill, sendBill, signIn } from "@/lib/bill-api";
import { BillFields, CodeField, readTip } from "@/components/BillFields";

// /pay/<token> — the waiter scanned a guest's Mesita QR (MESITA-4827, Pato:
// "you just need a scan of the qr and then just write 6 digits code ... not
// need to verify phones"): the bill, the tip, the restaurant's 6-digit code,
// Send. The code names the place; nothing about the phone is kept.

export default function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [bill, setBill] = useState("");
  const [tip, setTip] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const billCents = readAmount(bill);
  const tipCents = readTip(tip);
  const ready = billCents !== null && tipCents !== null && code.length === 6;

  async function send() {
    if (busy || billCents === null || tipCents === null || code.length !== 6) return;
    setBusy(true);
    setError(null);
    const fail = (r: "failed" | { error: string }) => {
      setError(r === "failed" ? "Couldn't reach Mesita. Tap again." : r.error);
      setBusy(false);
    };
    const key = await signIn(code);
    if (key === "failed" || "refused" in key) return fail(key);
    const staff = { place_id: key.place.id, staff_token: key.staff_token };
    const opened = await openBill(staff, { token });
    if (opened === "failed" || "refused" in opened) return fail(opened);
    // A rescan finds the same bill, maybe already sent: send over its version.
    const now = await getBill(staff, opened.bill_id);
    if (now === "failed" || "refused" in now) return fail(now);
    const sent = await sendBill(staff, { bill_id: opened.bill_id, version: now.bill.version, bill_cents: billCents, tip_cents: tipCents });
    if (sent === "failed" || "refused" in sent) return fail(sent);
    keepBillStaff(opened.bill_id, staff);
    router.replace(`/bill/${opened.bill_id}`);
  }

  return (
    <main className="proof" data-scan>
      <h1>Guest&apos;s bill</h1>
      <form
        style={{ alignSelf: "stretch" }}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <BillFields bill={bill} tip={tip} onBill={setBill} onTip={setTip} />
        <CodeField code={code} onCode={setCode} />
        {error ? (
          <p className="proof-status warn" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" style={{ minHeight: 56 }} disabled={busy || !ready}>
          {busy ? "Sending…" : "Send bill"}
        </button>
      </form>
    </main>
  );
}
