"use client";

// The three Business plans as one card of rows (MESITA-3173, Pato: "you
// actually buy access to all the software, don't separate premier"): Mesita
// Business Free · Pro · Ultra. Pro and Ultra are the boost_2x / boost_5x
// subscriptions and carry Premier 2X / 5X ranking, so the paid rows keep the
// Ad tag (package law). They lived on the Premier page until this issue.
//
// Every amount and date is the server's (business-web-get-premier's quotes);
// this file never computes money.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cancelPremier, getPremier, startPremier, type BoostInterval, type BoostTier, type PlacePremier } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { billingHref, returnUrl } from "@/lib/routes";
import { FREE_PLAN, PLAN_NAME } from "@/lib/plans";

const PLANS: Array<{ key: BoostTier; rank: number; factor: string }> = [
  { key: "boost_2x", rank: 1, factor: "2X" },
  { key: "boost_5x", rank: 2, factor: "5X" },
];

const REFUSED: Record<string, string> = {
  covered_by_mesita: "Mesita already gives this place that level. Nothing was charged.",
  premier_taken: "A guest already pays for Premier here. Stop their subscription first, then choose a plan.",
  charging: "A renewal is being charged. Try again in a few minutes.",
  not_payer: "Only the person who pays can update the card.",
  lost: "Your plan changed while you were choosing. Look again.",
};

const OUTCOME: Record<string, string> = {
  confirmed: "Your plan is on. Thank you.",
  declined: "The card was declined. Nothing was charged.",
  covered: "Mesita already gives this place that level. Nothing was charged.",
  pending: "Your payment is being confirmed. This page updates in a moment.",
  expired: "That checkout expired. Nothing was charged.",
  lost: "Someone else started a plan first. Nothing was charged.",
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

function day(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function AdTag() {
  return <span className="border-border text-muted-foreground type-label rounded-full border px-2 py-0.5 font-semibold">Ad</span>;
}

const rowClass = "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6";
const buttonClass = "h-10 w-32 rounded-full text-sm font-semibold disabled:opacity-50";

export function PlansCard({
  placeId,
  initial,
  picked = null,
}: {
  placeId: string;
  initial: PlacePremier | null;
  /** A plan Billing's Keep button picked. */
  picked?: BoostTier | null;
}) {
  const router = useRouter();
  const [data, setData] = useState<PlacePremier | null>(initial);
  const [interval, setBillingInterval] = useState<BoostInterval>(picked ? "month" : (initial?.mine?.interval ?? "month"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const pickedRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    pickedRef.current?.scrollIntoView({ block: "center" });
  }, []);

  if (!data?.quotes) return null;
  const quotes = data.quotes;
  const payer = data.viewer === "payer";
  const notice = data.outcome && OUTCOME[data.outcome] ? OUTCOME[data.outcome] : null;

  async function reload() {
    const r = await getPremier(placeId);
    if (r.ok) setData(r.data);
    else setError(r.error);
    router.replace(billingHref(placeId));
    router.refresh();
  }

  async function choose(tier: BoostTier) {
    setBusy(true);
    setError(null);
    const r = await startPremier({ placeId, tier, interval, returnUrl: returnUrl(billingHref(placeId)) });
    setBusy(false);
    if (!r.ok) return setError((r.code && REFUSED[r.code]) || r.error);
    if (r.data.url) return window.location.assign(r.data.url);
    await reload();
  }

  // Choosing Free is stopping your own renewal; the paid days run out.
  async function toFree() {
    setBusy(true);
    setError(null);
    setArmed(false);
    const r = await cancelPremier(placeId, false);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    await reload();
  }

  return (
    <Card className="flex scroll-mt-6 flex-col p-0 sm:p-0">
      <div id="plans" className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <h2 className="font-semibold">Plans</h2>
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
      {notice ? <p className="border-border border-t px-5 py-3 text-sm sm:px-6">{notice}</p> : null}
      <ul className="divide-border border-border divide-y border-t">
        <li className={rowClass}>
          <span className="min-w-0 flex-1 font-semibold">{FREE_PLAN}</span>
          <p className="text-sm">
            <span className="text-lg font-semibold">$0</span> / {interval}
          </p>
          {payer && data.paid?.renews ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => (armed ? void toFree() : setArmed(true))}
              onBlur={() => setArmed(false)}
              className={`border-border hover:bg-muted border ${buttonClass}`}
            >
              {armed ? "Tap again" : "Switch"}
            </button>
          ) : (
            <button type="button" disabled className={`border-border border ${buttonClass}`}>
              {payer && data.paid ? `From ${day(data.paid.ends_at)}` : "Your plan"}
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
          const resume = data.viewer === "former_payer" ? "Resume" : "Keep";
          const action =
            q.covered ? "Given by Mesita" : current ? "Your plan" : q.kind === "buy" ? "Choose" : q.kind === "resume" ? resume : q.kind === "change" ? "Switch" : "Unavailable";
          const isPicked = picked === plan.key;
          return (
            <li key={plan.key} ref={isPicked ? pickedRef : undefined} className={`${rowClass} ${isPicked ? "bg-muted/60" : ""}`}>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="font-semibold">{PLAN_NAME[plan.key]}</span>
                <span className="text-muted-foreground text-sm">Premier {plan.factor}</span>
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
                className={`bg-foreground text-background ${buttonClass}`}
              >
                {action}
              </button>
            </li>
          );
        })}
      </ul>
      {error ? <p className="text-destructive border-border border-t px-5 py-3 text-sm sm:px-6">{error}</p> : null}
    </Card>
  );
}
