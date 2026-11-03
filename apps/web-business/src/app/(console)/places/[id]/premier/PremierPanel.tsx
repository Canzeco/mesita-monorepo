"use client";

// Premier, as the place runs it (MESITA-3103). One Paid subscription per
// place, billed by Stripe in US dollars: Premier 2X at $10 a month, Premier
// 5X at $100 a month (a year is billed as ten months). It is advertising:
// the place ranks higher on Home and the Map and wears an "Ad" mark. It
// never verifies the place and never promises views.
//
// Every amount and date is the server's (business-web-get-premier's quotes);
// this file never computes money. Premier sells the plans; Billing shows
// what runs and what is charged (MESITA-3166, D3): the level here is one
// row and a link to Billing, whose Keep and See plans buttons come back with
// a plan picked. One card of rows since MESITA-3172.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  cancelPremier,
  getPremier,
  startPremier,
  type BoostInterval,
  type BoostTier,
  type PlacePremier,
} from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { billingHref, placeTabHref, returnUrl } from "@/lib/routes";
import { ORIGIN_OF_SOURCE, REFILL_ORIGIN } from "@/lib/premier-origin";

const PLANS: Array<{ key: BoostTier; rank: number; label: string; factor: string }> = [
  { key: "boost_2x", rank: 1, label: "Premier 2X", factor: "2X" },
  { key: "boost_5x", rank: 2, label: "Premier 5X", factor: "5X" },
];
const LABEL_BY_RANK: Record<number, string> = { 1: "Premier 2X", 2: "Premier 5X" };
const levelLabel = (tier: number) => LABEL_BY_RANK[tier] ?? "Premier";

const REFUSED: Record<string, string> = {
  covered_by_mesita: "Mesita already gives this place that level. Nothing was charged.",
  premier_taken: "A guest already pays for Premier here. Stop their subscription first, then choose a plan.",
  charging: "A renewal is being charged. Try again in a few minutes.",
  not_payer: "Only the person who pays can update the card.",
  lost: "Premier changed while you were choosing. Look again.",

};

const OUTCOME: Record<string, string> = {
  confirmed: "Premier is on. Thank you.",
  saved: "Your card is saved.",
  declined: "The card was declined. Nothing was charged.",
  covered: "Mesita already gives this place that level. Nothing was charged.",
  pending: "Your payment is being confirmed. This page updates in a moment.",
  expired: "That checkout expired. Nothing was charged.",
  lost: "Someone else started Premier first. Nothing was charged.",
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

function day(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The level in one line (D3): the Refill days, then the subscription. */
function summary(data: PlacePremier): string {
  const parts: string[] = [];
  if (data.manual) {
    const origin = REFILL_ORIGIN[ORIGIN_OF_SOURCE[data.manual.source ?? "admin"] ?? "mesita"];
    parts.push(`${levelLabel(data.manual.tier)} until ${day(data.manual.ends_at)} · ${origin}`);
  }
  if (data.paid) {
    parts.push(`${levelLabel(data.paid.tier)} paid ${data.paid.by_you ? "by you" : "by a guest"} · ${data.paid.renews ? "renews" : "ends"} ${day(data.paid.ends_at)}`);
  }
  if (data.renewing) parts.push("A renewal is being charged now");
  return parts.length ? `${parts.join(". ")}.` : "Your place ranks like every other place.";
}

function AdTag() {
  return <span className="border-border text-muted-foreground type-label rounded-full border px-2 py-0.5 font-semibold">Ad</span>;
}

export function PremierPanel({
  placeId,
  initial,
  loadError,
  picked = null,
}: {
  placeId: string;
  initial: PlacePremier | null;
  loadError: string | null;
  /** A plan Billing sent the owner here to choose. */
  picked?: BoostTier | null;
}) {
  const router = useRouter();
  const [data, setData] = useState<PlacePremier | null>(initial);
  const [interval, setBillingInterval] = useState<BoostInterval>(picked ? "month" : (initial?.mine?.interval ?? "month"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(loadError);
  const [armed, setArmed] = useState<string | null>(null);
  const pickedRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    pickedRef.current?.scrollIntoView({ block: "center" });
  }, []);
  const notice = data?.outcome && OUTCOME[data.outcome] ? OUTCOME[data.outcome] : null;

  async function reload() {
    const r = await getPremier(placeId);
    if (r.ok) setData(r.data);
    else setError(r.error);
    router.replace(placeTabHref(placeId, "premier"));
  }

  async function choose(tier: BoostTier) {
    setBusy(true);
    setError(null);
    const r = await startPremier({
      placeId,
      tier,
      interval,
      returnUrl: returnUrl(placeTabHref(placeId, "premier")),
    });
    setBusy(false);
    if (!r.ok) {
      setError((r.code && REFUSED[r.code]) || r.error);
      return;
    }
    if (r.data.url) {
      window.location.assign(r.data.url);
      return;
    }
    await reload();
  }

  async function stop(asPlace: boolean) {
    setBusy(true);
    setError(null);
    setArmed(null);
    const r = await cancelPremier(placeId, asPlace);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    await reload();
  }

  if (!data) {
    return (
      <Card>
        <p className="font-semibold">Premier didn&apos;t load.</p>
        <p className="text-muted-foreground mt-1 text-sm">{error}</p>
      </Card>
    );
  }

  const payer = data.viewer === "payer";
  const someoneElsePays = !!data.paid && !data.paid.by_you;
  const quotes = data.quotes;

  return (
    <div className="flex flex-col gap-4 pb-8">
      {notice ? <Card className="text-sm">{notice}</Card> : null}

      {/* One card of rows (MESITA-3172, Pato: "fix this shit"): what runs now,
          then one row per plan, No Premier first. No boxes inside the box, no blurbs, no fine
          print; the page subtitle already says it is an ad. */}
      <Card className="flex flex-col p-0 sm:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="font-semibold">{data.tier > 0 ? levelLabel(data.tier) : "Not Premier"}</p>
            {data.tier > 0 || data.renewing ? <p className="text-muted-foreground text-sm">{summary(data)}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* What runs, the schedule and every charge are Billing (MESITA-3166). */}
            <Link
              href={billingHref(placeId)}
              className="border-border hover:bg-muted inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold"
            >
              Billing
            </Link>
          </div>
        </div>
        {someoneElsePays ? (
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 sm:px-6">
            <p className="text-muted-foreground text-sm">A guest pays for this Premier.</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => (armed === "place" ? void stop(true) : setArmed("place"))}
              onBlur={() => setArmed(null)}
              className="border-border hover:bg-muted h-9 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
            >
              {armed === "place" ? "Tap again to stop it" : "Stop it"}
            </button>
          </div>
        ) : null}

        {quotes ? (
          <>
            <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 sm:px-6">
              <p className="font-semibold">Plans</p>
              <div className="bg-muted inline-flex rounded-full p-1 text-sm" role="radiogroup" aria-label="Billing">
                {(["month", "year"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={interval === v}
                    onClick={() => setBillingInterval(v)}
                    className={"rounded-full px-3 py-1 font-medium " + (interval === v ? "bg-card shadow-sm" : "text-muted-foreground")}
                  >
                    {v === "month" ? "Monthly" : "Yearly"}
                  </button>
                ))}
              </div>
            </div>
            <ul className="divide-border border-border divide-y border-t">
              {/* The free row first (Pato: "add Like No Premier"): choosing it
                  is stopping your own renewal; the paid days run out. */}
              <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
                <span className="min-w-0 flex-1 font-semibold">No Premier</span>
                <p className="text-sm">
                  <span className="text-lg font-semibold">$0</span> / {interval}
                </p>
                {payer && data.paid?.renews ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => (armed === "self" ? void stop(false) : setArmed("self"))}
                    onBlur={() => setArmed(null)}
                    className="border-border hover:bg-muted h-10 w-32 rounded-full border text-sm font-semibold disabled:opacity-60"
                  >
                    {armed === "self" ? "Tap again" : "Switch"}
                  </button>
                ) : (
                  <button type="button" disabled className="border-border h-10 w-32 rounded-full border text-sm font-semibold opacity-50">
                    {payer && data.paid ? "From " + day(data.paid.ends_at) : "Your plan"}
                  </button>
                )}
              </li>
              {PLANS.map((plan) => {
                const q = quotes[plan.key]?.[interval];
                if (!q) return null;
                const current = payer && data.mine?.tier === plan.rank && data.mine?.interval === interval;
                const blocked = q.kind === "blocked" || q.covered;
                // A resume for someone who never paid here is subscribing early,
                // in the last 7 days of Refill days (MESITA-3165).
                const resume = data.viewer === "former_payer" ? "Resume" : `Keep ${plan.factor}`;
                const action =
                  q.covered ? "Given by Mesita" : current ? "Your plan" : q.kind === "buy" ? "Choose" : q.kind === "resume" ? resume : q.kind === "change" ? "Switch" : "Unavailable";
                const isPicked = picked === plan.key;
                return (
                  <li
                    key={plan.key}
                    ref={isPicked ? pickedRef : undefined}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6 ${isPicked ? "bg-muted/60" : ""}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="font-semibold">{plan.label}</span>
                      <AdTag />
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        <span className="text-lg font-semibold">{usd(q.price_cents)}</span> / {interval}
                      </p>
                      {q.charge_cents !== q.price_cents && q.kind !== "blocked" ? (
                        <p className="text-muted-foreground text-xs">
                          {q.charge_cents > 0 ? `Now ${usd(q.charge_cents)}` : "Nothing now"}
                          {q.renews_at ? ` · from ${day(q.renews_at)}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={busy || blocked || current}
                      onClick={() => void choose(plan.key)}
                      className="bg-foreground text-background h-10 w-32 rounded-full text-sm font-semibold disabled:opacity-50"
                    >
                      {action}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </Card>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
