"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { openBill, signIn } from "@/lib/bill-api";
import { keepStaff, readStaff, rememberStaffPlace } from "@/lib/staff-key";
import { CODE_LENGTH } from "@/lib/code-boxes";
import { CodeBoxes } from "@/app/tab/[token]/CodeBoxes";
import { Bones } from "@/components/Bones";

// The waiter's phone, ready (MESITA-4823). Not signed in: the 4-digit waiter
// code. Signed in: "Scan the guest's Mesita QR" with the phone's camera, or
// the six digits under it when the camera can't. Only the 12-hour staff token
// is kept, never the code.

type Place = { id: string; name: string | null; hasCode: boolean };

export function WaiterSignIn({ placeId, scan }: { placeId: string; scan: string | null }) {
  const router = useRouter();
  const [place, setPlace] = useState<Place | "gone" | "failed" | null>(null);
  const [staff, setStaff] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let alive = true;
    void signIn(placeId).then((r) => {
      if (!alive) return;
      if (r === "failed") return setPlace("failed");
      if ("refused" in r) return setPlace("gone");
      setPlace({ id: r.place.id, name: r.place.name, hasCode: r.has_code });
      // A scan sent here means the kept token was refused: type the code.
      if (!scan) setStaff(readStaff(placeId));
    });
    return () => {
      alive = false;
    };
  }, [placeId, scan, tries]);

  async function open(token: string, by: { token: string } | { code: string }) {
    const r = await openBill({ place_id: placeId, staff_token: token }, by);
    if (r === "failed") return setError("Couldn't reach Mesita. Try again.");
    if ("refused" in r) {
      if (r.code === "staff_code_needed") {
        keepStaff(placeId, null, null);
        setStaff(null);
      }
      setDigits("");
      return setError(r.error);
    }
    router.push(`/bill/${r.bill_id}?place=${encodeURIComponent(placeId)}`);
  }

  async function enter() {
    if (busy || !place || place === "gone" || place === "failed") return;
    setBusy(true);
    setError(null);
    try {
      const r = await signIn(placeId, code.trim());
      setCode("");
      if (r === "failed") return setError("Couldn't reach Mesita. Try again.");
      if ("refused" in r) return setError(r.error);
      if (!r.staff_token) return setError("Couldn't sign in. Try again.");
      keepStaff(placeId, r.staff_token, r.staff_expires_at ?? null);
      rememberStaffPlace({ id: placeId, name: r.place.name });
      setStaff(r.staff_token);
      if (scan) await open(r.staff_token, { token: scan });
    } finally {
      setBusy(false);
    }
  }

  const alert = error ? (
    <p className="proof-status warn" role="alert">
      {error}
    </p>
  ) : null;

  if (place === null) {
    return (
      <main className="proof" data-waiter="loading">
        <Bones label="Opening your place" />
      </main>
    );
  }
  if (place === "gone" || place === "failed") {
    return (
      <main className="proof pay-end" data-waiter={place}>
        <h1>{place === "gone" ? "This link doesn't work" : "Couldn't reach Mesita"}</h1>
        {place === "gone" ? (
          <p className="proof-line">Ask the manager for the waiter link again.</p>
        ) : (
          <button type="button" style={{ marginTop: 16 }} onClick={() => { setPlace(null); setTries((n) => n + 1); }}>
            Try again
          </button>
        )}
      </main>
    );
  }
  if (!place.hasCode) {
    return (
      <main className="proof pay-end" data-waiter="no-code">
        <h1>{place.name ?? "A Mesita place"}</h1>
        <p className="proof-line">This place has no waiter code yet. The owner sets it on Business › Offers.</p>
      </main>
    );
  }

  if (!staff) {
    return (
      <main className="proof verify" data-waiter="code">
        <h1>{place.name ?? "A Mesita place"}</h1>
        <form className="verify-form" style={{ alignSelf: "stretch" }} onSubmit={(e) => { e.preventDefault(); void enter(); }}>
          <CodeBoxes value={code} onChange={setCode} />
          {alert}
          <button type="submit" style={{ minHeight: 56 }} disabled={busy || code.replace(/\D/g, "").length !== CODE_LENGTH}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="proof" data-waiter="ready">
      <h1>{place.name ?? "A Mesita place"}</h1>
      <p className="proof-line">Scan the guest&apos;s Mesita QR with this phone&apos;s camera.</p>
      <form
        style={{ alignSelf: "stretch", marginTop: 24 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || digits.length !== 6) return;
          setBusy(true);
          setError(null);
          void open(staff, { code: digits }).finally(() => setBusy(false));
        }}
      >
        <label className="field">
          Or type the 6 digits under it
          <input inputMode="numeric" autoComplete="off" maxLength={7} placeholder="000000" value={digits} onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </label>
        {alert}
        <button type="submit" style={{ minHeight: 56 }} disabled={busy || digits.length !== 6}>
          {busy ? "Opening…" : "Open the bill"}
        </button>
      </form>
    </main>
  );
}
