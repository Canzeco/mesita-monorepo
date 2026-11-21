"use client";

// Payouts to your bank (MESITA-4538, Pato: "it must include payments and
// payouts to your bank"). Read live from Stripe after the payments list has
// rendered, so a slow Stripe never holds the page. Its own Older. Its own card,
// the right column beside card payments (MESITA-4564, Pato: "two columns.
// payments left, payouts right").

import { useEffect, useState } from "react";
import Link from "next/link";
import { BankIcon } from "@phosphor-icons/react/dist/ssr";
import { getPayouts } from "@/lib/business-api";
import { day, money, payoutStatus, type Payout, type PayoutsAnswer } from "@/lib/monitor";
import { Dash, MonitorTable, type Column } from "./MonitorTable";

/** A payout's table (MESITA-4566): when Stripe sent it, to which bank, its
 *  state, when it lands, how much. */
function payoutColumns(timezone: string): Column<Payout>[] {
  return [
    { head: "Sent", cell: (p) => (p.created ? day(p.created, timezone) : <Dash />) },
    {
      head: "Bank",
      cell: (p) => (
        <span className="flex items-center gap-2">
          <span className="bg-muted text-muted-foreground grid size-6 place-items-center rounded-full">
            <BankIcon size={12} aria-hidden />
          </span>
          <span className="font-medium">{p.bank ?? "Your bank"}</span>
        </span>
      ),
    },
    { head: "Status", cell: (p) => (p.failure_message ? `${payoutStatus(p.status)} · ${p.failure_message}` : payoutStatus(p.status)) },
    { head: "Arrives", cell: (p) => (p.arrival_date ? day(p.arrival_date, timezone) : <Dash />) },
    { head: "Amount", align: "right", cell: (p) => <span className="font-semibold">{money(p.amount_cents, p.currency)}</span> },
  ];
}

export function Payouts({ placeId, timezone }: { placeId: string; timezone: string }) {
  const [answer, setAnswer] = useState<PayoutsAnswer | null>(null);
  const [rows, setRows] = useState<Payout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <section className="flex flex-col">
      {answer === null && !error ? (
        <ul className="flex flex-col gap-2 px-5 py-4 sm:px-6" aria-label="Loading payouts">
          {[0, 1, 2].map((i) => (
            <li key={i} className="bg-muted h-10 animate-pulse rounded-lg" />
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">Stripe didn&apos;t answer. Try again.</p> : null}
      {answer?.state === "stripe_error" ? <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">Stripe didn&apos;t answer. Try again.</p> : null}
      {answer?.state === "no_account" ? (
        <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">
          Connect Stripe on{" "}
          <Link href={`/places/${encodeURIComponent(placeId)}/payments`} className="font-semibold underline underline-offset-2">
            Offers
          </Link>{" "}
          to get paid to your bank.
        </p>
      ) : null}
      {answer?.state === "ok" ? (
        rows.length === 0 ? (
          <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">No payouts yet.</p>
        ) : (
          <MonitorTable columns={payoutColumns(timezone)} rows={rows} rowKey={(p) => p.id} />
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
    </section>
  );
}
