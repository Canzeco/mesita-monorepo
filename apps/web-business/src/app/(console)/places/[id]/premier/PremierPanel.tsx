"use client";

// Premier, as the place runs it (MESITA-3103): advertising. The place ranks
// higher on Home and the Map and wears an "Ad" mark; it never verifies the
// place and never promises views.
//
// Since MESITA-3173 Premier is not sold on its own: it comes with the Business
// plans (Pro = Premier 2X, Max = Premier 5X, MESITA-3174), which Billing
// lists. This page is one card: the level running now, Plan → Premier and
// Boost → Premier (MESITA-3176), then where to get it.
// Every amount and date is the server's (business-web-get-premier).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelPremier, getPremier, type PlacePremier } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { billingHref, placeTabHref } from "@/lib/routes";
import { ORIGIN_OF_SOURCE, REFILL_ORIGIN } from "@/lib/premier-origin";
import { FREE_LEVEL, FREE_PLAN, PLAN_LEVEL, PLAN_NAME, planName } from "@/lib/plans";

const LABEL_BY_RANK: Record<number, string> = { 1: "Premier 2X", 2: "Premier 5X" };
// Free is Premier 1X: the place ranks like every other place.
const levelLabel = (tier: number) => LABEL_BY_RANK[tier] ?? "Premier";

function day(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Plan → Premier and Boost → Premier (MESITA-3176, Pato: "Boost => Premier,
 *  Plan => Premier"): the place ranks at the higher of the two. */
function sources(data: PlacePremier): Array<{ name: string; value: string }> {
  const plan = data.paid
    ? `${planName(data.paid.tier)} → ${levelLabel(data.paid.tier)} · ${data.paid.by_you ? "" : "paid by a guest · "}${data.paid.renews ? "renews" : "ends"} ${day(data.paid.ends_at)}`
    : `${FREE_PLAN} → ${FREE_LEVEL}`;
  const boost = data.manual
    ? `${levelLabel(data.manual.tier)} until ${day(data.manual.ends_at)} · ${REFILL_ORIGIN[ORIGIN_OF_SOURCE[data.manual.source ?? "admin"] ?? "mesita"]}`
    : "None";
  return [
    { name: "Plan", value: plan },
    { name: "Boost", value: boost },
  ];
}

export function PremierPanel({ placeId, initial, loadError }: { placeId: string; initial: PlacePremier | null; loadError: string | null }) {
  const router = useRouter();
  const [data, setData] = useState<PlacePremier | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(loadError);
  const [armed, setArmed] = useState(false);

  // The place stopping a guest's paid Premier (MESITA-3103).
  async function stopGuest() {
    setBusy(true);
    setError(null);
    setArmed(false);
    const r = await cancelPremier(placeId, true);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    const next = await getPremier(placeId);
    if (next.ok) setData(next.data);
    else setError(next.error);
    router.replace(placeTabHref(placeId, "premier"));
  }

  if (!data) {
    return (
      <Card>
        <p className="font-semibold">Premier didn&apos;t load.</p>
        <p className="text-muted-foreground mt-1 text-sm">{error}</p>
      </Card>
    );
  }

  const someoneElsePays = !!data.paid && !data.paid.by_you;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Card className="flex flex-col p-0 sm:p-0">
        <div className="px-5 py-4 sm:px-6">
          <p className="font-semibold">{data.tier > 0 ? levelLabel(data.tier) : FREE_LEVEL}</p>
          {data.renewing ? <p className="text-muted-foreground text-sm">A renewal is being charged now.</p> : null}
        </div>
        <ul className="divide-border border-border divide-y border-t">
          {sources(data).map((row) => (
            <li key={row.name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 sm:px-6">
              <span className="w-16 shrink-0 text-sm font-semibold">{row.name}</span>
              <span className="text-muted-foreground min-w-0 flex-1 text-sm">{row.value}</span>
            </li>
          ))}
        </ul>
        {someoneElsePays ? (
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 sm:px-6">
            <p className="text-muted-foreground text-sm">A guest pays for this Premier.</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => (armed ? void stopGuest() : setArmed(true))}
              onBlur={() => setArmed(false)}
              className="border-border hover:bg-muted h-9 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
            >
              {armed ? "Tap again to stop it" : "Stop it"}
            </button>
          </div>
        ) : null}
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 sm:px-6">
          <p className="text-sm">
            Comes with {PLAN_NAME.boost_2x} ({PLAN_LEVEL.boost_2x}) and {PLAN_NAME.boost_5x} ({PLAN_LEVEL.boost_5x}).
          </p>
          <Link
            href={billingHref(placeId, {})}
            className="bg-foreground text-background inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold"
          >
            See plans
          </Link>
        </div>
      </Card>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
