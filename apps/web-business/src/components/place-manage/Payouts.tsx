"use client";

// Payouts to your bank (MESITA-4538, Pato: "it must include payments and
// payouts to your bank; leave a link to the stripe dashboard"). Read live from
// Stripe after the payments list has rendered, so a slow Stripe never holds the
// page. Its own Older. Open Stripe at the foot, only with a connected account.

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPayouts, openPaymentDashboard } from "@/lib/business-api";
import { day, money, payoutStatus, type Payout, type PayoutsAnswer } from "@/lib/monitor";

const ROW = "flex flex-col gap-1 px-5 py-3 text-sm sm:px-6";

function PayoutRow({ p, timezone }: { p: Payout; timezone: string }) {
  return (
    <li className={ROW}>
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 font-medium">{p.bank ?? "Your bank"}</p>
        <p className="shrink-0 font-semibold tabular-nums">{money(p.amount_cents, p.currency)}</p>
      </div>
      <p className="text-muted-foreground">
        {payoutStatus(p.status)}
        {p.arrival_date ? ` · ${p.status === "paid" ? "Arrived" : "Arrives"} ${day(p.arrival_date, timezone)}` : ""}
        {p.failure_message ? ` · ${p.failure_message}` : ""}
      </p>
    </li>
  );
}

export function Payouts({ placeId, timezone }: { placeId: string; timezone: string }) {
  const [answer, setAnswer] = useState<PayoutsAnswer | null>(null);
  const [rows, setRows] = useState<Payout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let live = true;
    void getPayouts(placeId).then((r) => {
      if (!live) return;
      if (!r.ok) return setError(r.error);
      setAnswer(r.data);
      if (r.data.state === "ok") setRows(r.data.payouts);
    });
    return () => {
      live = false;
    };
  }, [placeId]);

  async function older() {
    if (answer?.state !== "ok" || !answer.next || busy) return;
    setBusy(true);
    const r = await getPayouts(placeId, answer.next);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setAnswer(r.data);
    if (r.data.state === "ok") setRows((all) => [...all, ...(r.data as { payouts: Payout[] }).payouts]);
  }

  async function openStripe() {
    setOpening(true);
    const r = await openPaymentDashboard(placeId);
    setOpening(false);
    if (r.ok) window.open(r.data.url, "_blank", "noopener,noreferrer");
    else setError(r.error);
  }

  return (
    <section className="border-border flex flex-col border-t">
      <h2 className="px-5 pt-4 pb-2 font-semibold sm:px-6">Payouts to your bank</h2>
      {answer === null && !error ? (
        <ul className="flex flex-col gap-2 px-5 pb-4 sm:px-6" aria-label="Loading payouts">
          {[0, 1, 2].map((i) => (
            <li key={i} className="bg-muted h-10 animate-pulse rounded-lg" />
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-muted-foreground px-5 pb-4 text-sm sm:px-6">Stripe didn&apos;t answer. Try again.</p> : null}
      {answer?.state === "stripe_error" ? <p className="text-muted-foreground px-5 pb-4 text-sm sm:px-6">Stripe didn&apos;t answer. Try again.</p> : null}
      {answer?.state === "no_account" ? (
        <p className="text-muted-foreground px-5 pb-4 text-sm sm:px-6">
          Connect Stripe on{" "}
          <Link href={`/places/${encodeURIComponent(placeId)}/payments`} className="font-semibold underline underline-offset-2">
            Offers
          </Link>{" "}
          to get paid to your bank.
        </p>
      ) : null}
      {answer?.state === "ok" ? (
        rows.length === 0 ? (
          <p className="text-muted-foreground px-5 pb-4 text-sm sm:px-6">No payouts yet.</p>
        ) : (
          <ul className="divide-border divide-y">
            {rows.map((p) => (
              <PayoutRow key={p.id} p={p} timezone={timezone} />
            ))}
          </ul>
        )
      ) : null}
      {answer?.state === "ok" && answer.next ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground border-border border-t px-5 py-3 text-left text-sm font-semibold sm:px-6"
          disabled={busy}
          onClick={() => void older()}
        >
          {busy ? "Loading…" : "Older"}
        </button>
      ) : null}
      {answer?.state === "ok" || answer?.state === "stripe_error" ? (
        <div className="border-border border-t px-5 py-3 sm:px-6">
          <button
            type="button"
            className="bg-muted text-foreground hover:bg-muted/70 h-8 rounded-full px-3 text-xs font-semibold disabled:opacity-50"
            disabled={opening}
            onClick={() => void openStripe()}
          >
            {opening ? "Opening…" : "Open Stripe"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
