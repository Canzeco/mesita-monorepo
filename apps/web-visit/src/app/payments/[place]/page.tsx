"use client";

import { use, useEffect, useState } from "react";
import { clockTime, moneyLabel } from "@mesita/place-profile/lib/money";
import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band";
import { listPayments, type PaymentList } from "@/lib/visit-api";

// /payments/<place> — the staff list of the place's Mesita Payments
// (MESITA-3462). Staff type the place code once; the server answers the list
// and a 12-hour staff token, and every read after carries the token only,
// never the code. Reads every 15 s while the page is visible and stops while
// it is hidden. After two failed reads the list greys under "Reconnecting ·
// last updated HH:mm". A staff_only answer (the owner changed the code, or
// 12 hours passed) sends staff back to the code. Each row: amount + tip,
// time, ticket, Seen or a bold "Not seen". Nothing here says who paid.

const POLL_MS = 15_000;

type Screen = { kind: "form" } | { kind: "list"; token: string; list: PaymentList; updatedAt: string };

export default function PaymentsPage({ params }: { params: Promise<{ place: string }> }) {
  const { place } = use(params);
  const [screen, setScreen] = useState<Screen>({ kind: "form" });
  const [placeCode, setPlaceCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const token = screen.kind === "list" ? screen.token : null;

  // The read: by staff token, every 15 s while visible; none while hidden.
  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = async () => {
      const r = await listPayments({ place_id: place, staff_token: token });
      if (stopped) return;
      if (r === "failed") return setMisses((n) => n + 1);
      if ("kind" in r) {
        if (r.kind === "staff_only") {
          stopped = true;
          setError("Type the place code again.");
          setScreen({ kind: "form" });
          return;
        }
        return setMisses((n) => n + 1);
      }
      setMisses(0);
      setScreen({ kind: "list", token, list: r, updatedAt: r.server_time });
    };
    const start = () => {
      if (timer || document.visibilityState !== "visible") return;
      void tick();
      timer = setInterval(() => void tick(), POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    // The first list arrived with the code; the next read is 15 s later.
    timer = setInterval(() => void tick(), POLL_MS);
    if (document.visibilityState !== "visible") stop();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [place, token]);

  const code = placeCode.replace(/\s/g, "");
  const canShow = /^\d{6}$/.test(code) && !busy;

  async function show() {
    if (!canShow) return;
    setBusy(true);
    setError(null);
    const r = await listPayments({ place_id: place, place_code: code });
    setBusy(false);
    if (r === "failed") return setError("Couldn't read the payments. Try again.");
    if ("kind" in r) {
      const wait = r.retryAfterS ? ` Try again in ${Math.ceil(r.retryAfterS / 60)} min.` : "";
      return setError(`${r.error}${wait}`);
    }
    if (!r.staff_token) return setError("Couldn't read the payments. Try again.");
    setPlaceCode("");
    setMisses(0);
    setScreen({ kind: "list", token: r.staff_token, list: r, updatedAt: r.server_time });
  }

  if (screen.kind === "list") {
    const { list } = screen;
    const reconnecting = misses >= 2;
    return (
      <main className="proof" data-payments-state={reconnecting ? "reconnecting" : "live"}>
        {list.test_mode ? (
          <p className="test-band" role="status" data-test-band>
            {TEST_BAND_TEXT}
          </p>
        ) : null}
        <h1>Mesita Payments</h1>
        <p className="proof-place">{list.place.name ?? "A Mesita place"} · last 12 hours</p>
        {reconnecting ? (
          <p className="proof-status" role="status">
            Reconnecting · last updated {clockTime(screen.updatedAt)}
          </p>
        ) : null}
        {list.payments.length === 0 ? (
          <p className="payments-empty" data-payments-empty>
            No Mesita Payments in the last 12 hours
          </p>
        ) : (
          <ul className={reconnecting ? "payments stale" : "payments"} aria-live="polite">
            {list.payments.map((p) => (
              <li key={p.id} data-payment-row>
                <span className="payment-main">
                  <span className="payment-amount">
                    {moneyLabel(p.amount_cents, p.currency)}
                    {p.tip_cents > 0 ? ` + ${moneyLabel(p.tip_cents, p.currency)} tip` : ""}
                  </span>
                  <span className="payment-meta">
                    {/* A bill paid outside (MESITA-3545): the Received time is the confirmation. */}
                    {p.expired ? "Outside · Expired" : p.outside ? `Outside · Received ${clockTime(p.paid_at)}` : clockTime(p.paid_at)}
                    {p.ticket ? ` · Ticket ${p.ticket}` : ""}
                    {p.refunded ? " · Refunded" : ""}
                  </span>
                </span>
                {p.outside ? null : p.seen ? <span className="payment-seen">Seen</span> : <strong className="payment-unseen">Not seen</strong>}
              </li>
            ))}
          </ul>
        )}
      </main>
    );
  }

  return (
    <main className="proof" data-payments-state="form">
      <h1>Mesita Payments</h1>
      <p>Type the place code to see this place&apos;s payments of the last 12 hours.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void show();
        }}
        style={{ alignSelf: "stretch" }}
      >
        <label className="field">
          Place code
          <input
            className="secret"
            inputMode="numeric"
            autoComplete="off"
            maxLength={7}
            value={placeCode}
            onChange={(e) => setPlaceCode(e.target.value)}
          />
        </label>
        {error ? (
          <p className="proof-status warn" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={!canShow}>
          {busy ? "Opening…" : "Show payments"}
        </button>
      </form>
    </main>
  );
}
