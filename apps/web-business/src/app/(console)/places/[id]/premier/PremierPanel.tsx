"use client";

// Premier, as the place runs it (MESITA-3103). One Paid subscription per
// place, billed by Stripe in US dollars: Premier 2X at $10 a month, Premier
// 5X at $100 a month (a year is billed as ten months). It is advertising:
// the place ranks higher on Home and the Map and wears an "Ad" mark. It
// never verifies the place and never promises views.
//
// Every amount and date is the server's (business-web-get-premier's quotes);
// this file never computes money.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import {
  cancelPremier,
  getPremier,
  startPremier,
  type BoostInterval,
  type BoostTier,
  type PlacePremier,
} from "@/lib/business-api";
import { Card } from "@/components/shell/Page";

const PLANS: Array<{ key: BoostTier; rank: number; label: string; factor: string; blurb: string }> = [
  { key: "boost_2x", rank: 1, label: "Premier 2X", factor: "2X", blurb: "Twice the ranking priority on Home and the Map." },
  { key: "boost_5x", rank: 2, label: "Premier 5X", factor: "5X", blurb: "Five times the ranking priority on Home and the Map." },
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

function AdTag() {
  return <span className="border-border text-muted-foreground type-label rounded-full border px-2 py-0.5 font-semibold">Ad</span>;
}

export function PremierPanel({
  placeId,
  initial,
  loadError,
}: {
  placeId: string;
  initial: PlacePremier | null;
  loadError: string | null;
}) {
  const router = useRouter();
  const [data, setData] = useState<PlacePremier | null>(initial);
  const [interval, setBillingInterval] = useState<BoostInterval>(initial?.mine?.interval ?? "month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(loadError);
  const [armed, setArmed] = useState<string | null>(null);
  const notice = data?.outcome && OUTCOME[data.outcome] ? OUTCOME[data.outcome] : null;

  async function reload() {
    const r = await getPremier(placeId);
    if (r.ok) setData(r.data);
    else setError(r.error);
    router.replace(`/places/${encodeURIComponent(placeId)}/premier`);
  }

  async function choose(tier: BoostTier) {
    setBusy(true);
    setError(null);
    const r = await startPremier({
      placeId,
      tier,
      interval,
      returnUrl: `${window.location.origin}/places/${encodeURIComponent(placeId)}/premier`,
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

  async function updateCard() {
    setBusy(true);
    setError(null);
    const r = await startPremier({ placeId, updateCard: true, returnUrl: `${window.location.origin}/places/${encodeURIComponent(placeId)}/premier` });
    setBusy(false);
    if (!r.ok) return setError((r.code && REFUSED[r.code]) || r.error);
    if (r.data.url) window.location.assign(r.data.url);
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
    <div className="flex max-w-3xl flex-col gap-4 pb-8">
      {notice ? <Card className="text-sm">{notice}</Card> : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <BadgeCheck className="size-5 text-(--brand-pink-text)" aria-hidden />
          <p className="font-semibold">{data.tier > 0 ? levelLabel(data.tier) : "Not Premier"}</p>
          {data.tier > 0 ? <AdTag /> : null}
        </div>
        <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
          {data.manual ? <li>{levelLabel(data.manual.tier)} from Mesita until {day(data.manual.ends_at)}. Free.</li> : null}
          {data.paid ? (
            <li>
              {levelLabel(data.paid.tier)} paid {data.paid.by_you ? "by you" : "by a guest"} · {data.paid.renews ? "renews" : "ends"} {day(data.paid.ends_at)}
            </li>
          ) : null}
          {data.renewing ? <li>A renewal is being charged now.</li> : null}
          {!data.manual && !data.paid ? <li>Your place ranks like every other place.</li> : null}
        </ul>
        {payer ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void updateCard()} className="border-border hover:bg-muted h-9 rounded-full border px-4 text-sm font-semibold disabled:opacity-60">
              Update card
            </button>
            {data.paid?.renews ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => (armed === "self" ? void stop(false) : setArmed("self"))}
                onBlur={() => setArmed(null)}
                className="border-border hover:bg-muted h-9 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
              >
                {armed === "self" ? "Tap again to stop renewing" : "Stop renewing"}
              </button>
            ) : null}
          </div>
        ) : null}
        {someoneElsePays ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">
              A guest pays for this place&apos;s Premier. You run the place, so you may stop it: the paid days run out, it does not renew, and the guest is told why.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => (armed === "place" ? void stop(true) : setArmed("place"))}
              onBlur={() => setArmed(null)}
              className="border-border hover:bg-muted h-9 w-fit rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
            >
              {armed === "place" ? "Tap again to stop the guest's Premier" : "Stop this subscription"}
            </button>
          </div>
        ) : null}
      </Card>

      {quotes ? (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
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
                  {v === "month" ? "Monthly" : "Yearly (10 months)"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PLANS.map((plan) => {
              const q = quotes[plan.key]?.[interval];
              if (!q) return null;
              const current = payer && data.mine?.tier === plan.rank && data.mine?.interval === interval;
              const blocked = q.kind === "blocked" || q.covered;
              const action =
                q.covered ? "Given by Mesita" : current ? "Your plan" : q.kind === "buy" ? "Choose" : q.kind === "resume" ? "Resume" : q.kind === "change" ? "Switch" : "Unavailable";
              return (
                <div key={plan.key} className="border-border flex flex-col gap-3 rounded-2xl border p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-semibold">{plan.label}</span>
                    <AdTag />
                  </div>
                  <p className="text-muted-foreground text-sm">{plan.blurb}</p>
                  <p className="text-sm">
                    <span className="text-2xl font-semibold">{usd(q.price_cents)}</span> / {interval}
                  </p>
                  {q.charge_cents !== q.price_cents && q.kind !== "blocked" ? (
                    <p className="text-muted-foreground text-sm">
                      {q.charge_cents > 0 ? `Charged now: ${usd(q.charge_cents)}` : "Nothing charged now"}
                      {q.renews_at ? ` · from ${day(q.renews_at)}` : ""}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || blocked || current}
                    onClick={() => void choose(plan.key)}
                    className="bg-foreground text-background mt-auto h-10 rounded-full text-sm font-semibold disabled:opacity-50"
                  >
                    {action}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <p className="text-muted-foreground text-xs leading-relaxed">
        Premier is paid advertising. A Premier place ranks higher on Home and the Map and is marked &ldquo;Ad&rdquo;. It never
        verifies a place, never changes its reviews and never promises a number of views. One subscription per place, billed by
        Stripe in US dollars; a declined renewal ends it.
      </p>
    </div>
  );
}
