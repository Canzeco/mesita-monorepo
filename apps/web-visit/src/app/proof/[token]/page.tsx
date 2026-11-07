"use client";

import { use, useEffect, useState } from "react";
import { clockTime, moneyLabel } from "@mesita/place-profile/lib/money";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { getProof, markProofSeen, type Proof, VisitError } from "@/lib/visit-api";

// /proof/<token> — the staff page for a guest's payment proof (MESITA-3304,
// W2a). The guest's Pay tab shows a QR; staff scan it and land here. The
// page reads the proof once: the amount, when it was paid, the ticket, the
// place, and a clock ticking from the server's time (a screenshot's clock
// stands still). The guard against a proof shown twice is the seen stamp:
// "Mark as seen" sets it once, and a proof already seen leads with "Already
// seen" in the warning tone. Nothing here says who paid.

type Read = { kind: "loading" } | { kind: "ok"; proof: Proof; firstSeen: string | null } | { kind: "invalid" } | { kind: "failed" };

export default function ProofPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [read, setRead] = useState<Read>({ kind: "loading" });
  const [nonce, setNonce] = useState(0);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [markFailed, setMarkFailed] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProof(token)
      .then((proof) => {
        if (cancelled) return;
        // The clock runs from the server's time, offset by this phone's.
        const offset = Date.parse(proof.server_time) - Date.now();
        setRead({ kind: "ok", proof, firstSeen: proof.seen_at });
        setNow(Date.now() + offset);
        const timer = setInterval(() => setNow(Date.now() + offset), 1000);
        cleanup = () => clearInterval(timer);
      })
      .catch((e) => {
        if (cancelled) return;
        setRead({ kind: e instanceof VisitError && e.invalid ? "invalid" : "failed" });
      });
    let cleanup = () => {};
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [token, nonce]);

  async function mark() {
    setMarking(true);
    setMarkFailed(false);
    try {
      const r = await markProofSeen(token);
      setSeenAt(r.seen_at);
    } catch (e) {
      if (e instanceof VisitError && e.invalid) setRead({ kind: "invalid" });
      else setMarkFailed(true);
    } finally {
      setMarking(false);
    }
  }

  if (read.kind === "invalid") {
    return (
      <main className="proof">
        <p className="proof-status warn" role="alert">
          This proof is not valid. Ask the guest to show it again.
        </p>
      </main>
    );
  }
  if (read.kind === "failed") {
    return (
      <main className="proof">
        <p className="proof-status" role="alert">
          Couldn&apos;t check this proof. Try again.
        </p>
        <button type="button" onClick={() => { setRead({ kind: "loading" }); setNonce((n) => n + 1); }}>
          Try again
        </button>
      </main>
    );
  }
  if (read.kind === "loading") {
    return (
      <main className="proof">
        <p className="proof-status" role="status">
          Checking…
        </p>
      </main>
    );
  }

  const { proof, firstSeen } = read;
  const refunded = proof.status === "refunded";
  const partly = proof.status === "partly_refunded";
  const clock = now === null ? "" : clockTime(new Date(now).toISOString(), new Date(now)) + ":" + String(new Date(now).getSeconds()).padStart(2, "0");

  return (
    <main className="proof">
      {proof.test_mode ? (
        <p className="test-band" role="status" data-test-band>
          {TEST_BAND_TEXT}
        </p>
      ) : null}
      {firstSeen ? (
        <p className="proof-status warn" role="alert">
          Already seen · {clockTime(firstSeen)}
        </p>
      ) : null}
      <p className="proof-amount">{moneyLabel(proof.amount_cents, proof.currency)}</p>
      {refunded || partly ? <p className="proof-status warn">{refunded ? "Refunded" : "Partly refunded"}</p> : null}
      <p className="proof-line">
        Paid · {clockTime(proof.paid_at)}
        {clock ? <span className="proof-clock"> · now {clock}</span> : null}
      </p>
      {proof.ticket ? <p className="proof-line">Ticket {proof.ticket}</p> : null}
      <p className="proof-place">{proof.place.name ?? "A Mesita place"}</p>

      <div className="proof-foot">
        {firstSeen ? null : seenAt ? (
          <p className="proof-done" role="status">
            Seen · {clockTime(seenAt)}
          </p>
        ) : (
          <>
            {markFailed ? (
              <p className="proof-status" role="alert">
                Couldn&apos;t check this proof. Try again.
              </p>
            ) : null}
            <button type="button" onClick={() => void mark()} disabled={marking}>
              {marking ? "Marking…" : "Mark as seen"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
