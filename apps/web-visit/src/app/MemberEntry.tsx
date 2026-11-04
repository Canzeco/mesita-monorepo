"use client";

import { useState } from "react";
import { findVisit } from "@/lib/visit-api";
import { VisitFlow } from "./VisitFlow";

// When the QR won't scan (Pato, MESITA-3262: "if not scan, enable to manually input
// member number"). The member number and the place code go together: alone, a sequential
// member number would read any guest's name on a page with no sign-in. A match opens
// the same visit a scan does, and the place code just typed stays filled in.

/** Eight digits read as 1234-5678, however they were typed. */
function memberNumberText(typed: string): string {
  const digits = typed.replace(/\D/g, "").slice(0, 8);
  return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
}

export function MemberEntry() {
  const [memberNumber, setMemberNumber] = useState("");
  const [placeCode, setPlaceCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<{ place_id: string; code: string } | null>(null);

  if (found) return <VisitFlow placeId={found.place_id} code={found.code} placeCode={placeCode} />;

  const ready = /^\d{4}-\d{4}$/.test(memberNumber) && /^\d{6}$/.test(placeCode);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      setFound(await findVisit(memberNumber, placeCode));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Mesita Visit</h1>
      <p>Scan a guest&apos;s QR with your camera. If it won&apos;t scan, type the member number under it.</p>
      <form onSubmit={(e) => void submit(e)}>
        <label className="field">
          <span>Member number</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="1234-5678"
            value={memberNumber}
            onChange={(e) => setMemberNumber(memberNumberText(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Place code</span>
          <input
            className="secret"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={placeCode}
            onChange={(e) => setPlaceCode(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={!ready || busy}>
          {busy ? "Opening…" : "Open visit"}
        </button>
      </form>
    </main>
  );
}
