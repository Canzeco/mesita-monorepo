"use client";

// Premier, as the place runs it (MESITA-3103): advertising. The place ranks
// higher on Home and the Map and wears an "Ad" mark; it never verifies the
// place and never promises views.
//
// Since MESITA-3173 Premier is not sold on its own: it comes with the Business
// plans (Pro = Premier 2X, Max = Premier 5X, MESITA-3174), which Billing
// lists. This page is one card: the level running now, then Plan and Boost,
// the two things that set it (MESITA-3176, MESITA-3178).
// Every amount and date is the server's (business-web-get-premier).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelPremier, getPremier, type PlacePremier } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { billingHref, placeTabHref } from "@/lib/routes";
import { ORIGIN_OF_SOURCE, REFILL_ORIGIN } from "@/lib/premier-origin";
import { FREE_LEVEL, FREE_PLAN, planName } from "@/lib/plans";

const LABEL_BY_RANK: Record<number, string> = { 1: "Premier 2X", 2: "Premier 5X" };
// Free is Premier 1X: the place ranks like every other place.
const levelLabel = (tier: number) => LABEL_BY_RANK[tier] ?? "Premier";

function day(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Plan → Premier and Boost → Premier (MESITA-3176, Pato: "Boost => Premier,
 *  Plan => Premier"): the place ranks at the higher of the two. Each row is
 *  its source's name, then its level and dates in one quiet line (MESITA-3178). */
function sources(data: PlacePremier): Array<{ name: string; value: string; detail: string | null }> {
  const plan = data.paid
    ? {
        value: planName(data.paid.tier),
        detail: `${levelLabel(data.paid.tier)} · ${data.paid.by_you ? "" : "paid by a guest · "}${data.paid.renews ? "renews" : "ends"} ${day(data.paid.ends_at)}`,
      }
    : { value: FREE_PLAN, detail: FREE_LEVEL };
  const boost = data.manual
    ? {
        value: levelLabel(data.manual.tier),
        detail: `until ${day(data.manual.ends_at)} · ${REFILL_ORIGIN[ORIGIN_OF_SOURCE[data.manual.source ?? "admin"] ?? "mesita"]}`,
      }
    : { value: "None", detail: null };
  return [
    { name: "Plan", ...plan },
    { name: "Boost", ...boost },
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
      {/* One card (MESITA-3178): the level the place runs at, then where it
          comes from, Plan and Boost, one row each. Plans live on Billing. */}
      <Card className="flex flex-col p-0 sm:p-0">
        <div className="px-5 py-5 sm:px-6">
          <p className="font-display text-2xl font-semibold tracking-tight">{data.tier > 0 ? levelLabel(data.tier) : FREE_LEVEL}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {data.renewing ? "A renewal is being charged now." : "Your place ranks at the higher of its plan and a Boost."}
          </p>
        </div>
        <ul className="divide-border border-border divide-y border-t">
          {sources(data).map((row) => (
            <li key={row.name} className="flex items-center gap-4 px-5 py-4 sm:px-6">
              <span className="text-muted-foreground w-14 shrink-0 text-sm">{row.name}</span>
              <div className="min-w-0 flex-1">
                <p className={row.detail ? "font-semibold" : "text-muted-foreground"}>{row.value}</p>
                {row.detail ? <p className="text-muted-foreground text-sm">{row.detail}</p> : null}
              </div>
              {row.name === "Plan" ? (
                <Link
                  href={billingHref(placeId, {})}
                  className="border-border hover:bg-muted inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-semibold"
                >
                  Change
                </Link>
              ) : null}
            </li>
          ))}
          {someoneElsePays ? (
            <li className="flex items-center gap-4 px-5 py-4 sm:px-6">
              <p className="text-muted-foreground min-w-0 flex-1 text-sm">A guest pays for this Premier.</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => (armed ? void stopGuest() : setArmed(true))}
                onBlur={() => setArmed(false)}
                className="border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
              >
                {armed ? "Tap again to stop it" : "Stop it"}
              </button>
            </li>
          ) : null}
        </ul>
      </Card>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
