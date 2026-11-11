"use client";

import { use, useEffect, useRef, useState } from "react";
import { clockTime } from "@mesita/place-profile/lib/money";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { joinStaff, type JoinedStaff } from "@/lib/visit-api";
import { keepStaff, takeNext } from "@/lib/staff-key";

// /staff/<place>#<secret> — the Staff QR (MESITA-3696). The owner prints it
// on Business › Payments; a waiter scans it once per shift with the phone's
// camera and lands here. The secret rides in the address's # part, which a
// browser never sends to a server, and this page wipes it from the address
// at once (history.replaceState) before trading it for the 12-hour staff
// token (visit-web-join-staff). The token is kept on this phone exactly
// where /tab reads it, so the next guest QR goes straight to the bill.

type Screen = { kind: "joining" } | { kind: "set"; joined: JoinedStaff } | { kind: "refused"; error: string } | { kind: "failed" };

export default function StaffPage({ params }: { params: Promise<{ place: string }> }) {
  const { place } = use(params);
  const [screen, setScreen] = useState<Screen>({ kind: "joining" });
  // One trade per page: the secret is gone from the address after the first.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const secret = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    void joinStaff(place, secret).then((r) => {
      if (r === "failed") return setScreen({ kind: "failed" });
      if ("refused" in r) return setScreen({ kind: "refused", error: r.refused });
      keepStaff(place, r.staff_token, r.staff_token_expires_at);
      // MESITA-3708: back to the guest's payment the waiter was verifying.
      const next = takeNext();
      if (next) return window.location.replace(next);
      setScreen({ kind: "set", joined: r });
    });
  }, [place]);

  if (screen.kind === "joining") {
    return (
      <main className="proof" data-staff-state="joining">
        <p className="proof-status" role="status">
          Signing you in…
        </p>
      </main>
    );
  }
  if (screen.kind === "set") {
    const { joined } = screen;
    return (
      <main className="proof" data-staff-state="set">
        {joined.test_mode ? (
          <p className="test-band" role="status" data-test-band>
            {TEST_BAND_TEXT}
          </p>
        ) : null}
        <p className="proof-status ok" role="status">
          You&apos;re set
        </p>
        <p className="proof-place">{joined.place.name ?? "This place"}</p>
        <p className="proof-line">Until {clockTime(joined.staff_token_expires_at)} on this phone.</p>
        <p className="proof-foot">Scan a guest&apos;s Mesita QR to verify their payment. No code needed.</p>
      </main>
    );
  }
  return (
    <main className="proof" data-staff-state={screen.kind}>
      <p className="proof-status warn" role="alert">
        {screen.kind === "refused" ? screen.error : "Couldn't sign you in. Check the connection and scan the Staff QR again."}
      </p>
      <p className="proof-foot">You can still type the waiter code when you bill a guest.</p>
    </main>
  );
}
