"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { openBill } from "@/lib/bill-api";
import { readStaff, readStaffPlaces, rememberStaffPlace, type StaffPlace } from "@/lib/staff-key";
import { Bones } from "@/components/Bones";

// /pay/<token> — the waiter scanned a guest's Mesita QR (MESITA-4823). The QR
// names no place: the phone's own place opens the bill. One place: straight
// through. Several: the waiter picks. None: the manager's waiter link.

export default function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [places, setPlaces] = useState<StaffPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(place: StaffPlace) {
    setBusy(true);
    setError(null);
    const signIn = () => router.replace(`/waiter/${encodeURIComponent(place.id)}?scan=${encodeURIComponent(token)}`);
    const staff = readStaff(place.id);
    if (!staff) return signIn();
    const r = await openBill({ place_id: place.id, staff_token: staff }, { token });
    if (r !== "failed" && !("refused" in r)) {
      rememberStaffPlace(place);
      return router.replace(`/bill/${r.bill_id}?place=${encodeURIComponent(place.id)}`);
    }
    if (r !== "failed" && r.code === "staff_code_needed") return signIn();
    setBusy(false);
    setError(r === "failed" ? "Couldn't reach Mesita. Try again." : r.error);
  }

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      const known = readStaffPlaces();
      setPlaces(known);
      if (known.length === 1) void go(known[0]);
    });
    return () => {
      alive = false;
    };
    // Once, for this scan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (places === null || (busy && !error)) {
    return (
      <main className="proof" data-scan="loading">
        <Bones label="Opening the bill" />
      </main>
    );
  }
  if (places.length === 0) {
    return (
      <main className="proof pay-end" data-scan="unknown-phone">
        <h1>This phone isn&apos;t set up</h1>
        <p className="proof-line">Ask the manager for the waiter link, open it once, then scan the guest&apos;s QR again.</p>
      </main>
    );
  }
  return (
    <main className="proof" data-scan="pick">
      <h1>{places.length > 1 ? "Where are you?" : (places[0].name ?? "Your place")}</h1>
      {error ? (
        <p className="proof-status warn" role="alert">
          {error}
        </p>
      ) : null}
      <div style={{ display: "grid", gap: 8, alignSelf: "stretch", marginTop: 16 }}>
        {places.map((p) => (
          <button key={p.id} type="button" disabled={busy} onClick={() => void go(p)}>
            {places.length > 1 ? (p.name ?? "A Mesita place") : "Try again"}
          </button>
        ))}
      </div>
    </main>
  );
}
