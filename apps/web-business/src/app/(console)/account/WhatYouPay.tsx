"use client";

// What you pay (MESITA-3130): every Premier subscription this account pays,
// on any place, including places you no longer run (you left, were removed,
// handed it over or the claim expired). Only the payer changes the card or
// stops renewing, so both work here without the place. Every amount and date
// is the server's (business-web-list-billing).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { listBilling, startPremier, stopMyPremier, type MySubscription } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { ACCOUNT, premierHref, returnUrl } from "@/lib/routes";
import { PLAN_NAME } from "@/lib/plans";


const OUTCOME: Record<string, string> = {
  saved: "Your card is saved.",
  pending: "Your card is being confirmed. This page updates in a moment.",
  expired: "That checkout expired. Nothing changed.",
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

function day(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function WhatYouPay({
  initial,
  loadError,
  outcome,
}: {
  initial: MySubscription[] | null;
  loadError: string | null;
  outcome: string | null;
}) {
  const router = useRouter();
  const [subs, setSubs] = useState<MySubscription[] | null>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(loadError);
  const notice = outcome && OUTCOME[outcome] ? OUTCOME[outcome] : null;

  async function reload() {
    const r = await listBilling();
    if (r.ok) setSubs(r.data.subscriptions);
    else setError(r.error);
    router.replace(ACCOUNT);
  }

  async function updateCard(sub: MySubscription) {
    setBusy(sub.id);
    setError(null);
    const r = await startPremier({ placeId: sub.place_id, updateCard: true, returnUrl: returnUrl(ACCOUNT) });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    if (r.data.url) window.location.assign(r.data.url);
  }

  async function stop(sub: MySubscription) {
    setBusy(sub.id);
    setError(null);
    setArmed(null);
    const r = await stopMyPremier(sub.id);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    await reload();
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">What you pay</h2>
        <p className="text-muted-foreground text-sm">Premier you pay for, on every place, whether or not you still run it.</p>
      </div>
      {notice ? <Card className="text-sm">{notice}</Card> : null}
      {subs === null ? (
        <Card>
          <p className="font-semibold">Billing didn&apos;t load.</p>
          <p className="text-muted-foreground mt-1 text-sm">{error}</p>
        </Card>
      ) : subs.length === 0 ? (
        <Card className="text-muted-foreground text-sm">You pay for nothing yet. Premier is bought on a place&apos;s Premier page.</Card>
      ) : (
        <Card className="divide-border divide-y p-0 sm:p-0">
          {subs.map((sub) => (
            <div key={sub.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {sub.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sub.photo} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <MapPin className="text-muted-foreground size-4" aria-hidden />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{sub.name ?? "A place"}</p>
                  <p className="text-muted-foreground text-sm">
                    {PLAN_NAME[sub.tier as keyof typeof PLAN_NAME] ?? "Plan"} · {usd(sub.amount_cents)} a {sub.interval}
                    {sub.ends_at ? ` · ${sub.renews ? "renews" : "ends"} ${day(sub.ends_at)}` : ""}
                  </p>
                  {!sub.runs_place ? <p className="text-muted-foreground text-xs">You no longer run this place; you still pay for its Premier.</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {sub.runs_place ? (
                  <Link
                    href={premierHref(sub.place_id)}
                    className="border-border hover:bg-muted inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold"
                  >
                    Open Premier
                  </Link>
                ) : null}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void updateCard(sub)}
                  className="border-border hover:bg-muted h-9 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
                >
                  Update card
                </button>
                {sub.renews ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => (armed === sub.id ? void stop(sub) : setArmed(sub.id))}
                    onBlur={() => setArmed(null)}
                    className="border-border hover:bg-muted h-9 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
                  >
                    {armed === sub.id ? "Tap again to stop renewing" : "Stop renewing"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}
      {error && subs !== null ? <p className="text-destructive text-sm">{error}</p> : null}
    </section>
  );
}
