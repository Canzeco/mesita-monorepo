"use client";

// Premier, as the place runs it (MESITA-3103): advertising. The place ranks
// higher on Home and the Map and wears an "Ad" mark; it never verifies the
// place and never promises views.
//
// Since MESITA-3173 Premier is not sold on its own: it comes with the Business
// plans (Pro = Premier 2X, Max = Premier 5X, MESITA-3174), which Billing
// lists. This page is one card: the level and its meter, then Plan and Boost,
// the two things that set it, each ending in the level it gives (MESITA-3182).
// Every amount and date is the server's (business-web-get-premier).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelPremier, getPremier, type PlacePremier } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { billingHref, placeTabHref } from "@/lib/routes";
import { ORIGIN_OF_SOURCE, REFILL_ORIGIN } from "@/lib/premier-origin";
import { FREE_PLAN, PLAN_NAME, planName } from "@/lib/plans";

// The meter's steps: the plan that gives each level. Free is 1X, where every
// place ranks. Red is Consumer's Premier level meter (MAP_PREMIER_PIN_COLOR).
const STEPS = [
  { rank: 0, factor: "1X", plan: FREE_PLAN },
  { rank: 1, factor: "2X", plan: PLAN_NAME.boost_2x },
  { rank: 2, factor: "5X", plan: PLAN_NAME.boost_5x },
];
const PREMIER_RED = "#ff2357";
const factor = (tier: number) => STEPS.find((s) => s.rank === tier)?.factor ?? "1X";

function day(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Plan → Premier and Boost → Premier (MESITA-3176, Pato: "Boost => Premier,
 *  Plan => Premier"): each row ends in the level it gives, and the place runs
 *  at the higher of the two (MESITA-3182). */
function sources(data: PlacePremier): Array<{ name: string; value: string; detail: string | null; level: string | null }> {
  const plan = data.paid
    ? {
        value: planName(data.paid.tier),
        detail: `${data.paid.by_you ? "" : "Paid by a guest · "}${data.paid.renews ? "Renews" : "Ends"} ${day(data.paid.ends_at)}`,
        level: factor(data.paid.tier),
      }
    : { value: FREE_PLAN, detail: null, level: "1X" };
  const boost = data.manual
    ? {
        value: REFILL_ORIGIN[ORIGIN_OF_SOURCE[data.manual.source ?? "admin"] ?? "mesita"],
        detail: `Until ${day(data.manual.ends_at)}`,
        level: factor(data.manual.tier),
      }
    : { value: "None", detail: null, level: null };
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
      {/* One card: the level and where it sits on the meter, then what sets it.
          The page title already says Premier, so the headline is the number. */}
      <Card className="flex flex-col p-0 sm:p-0">
        <div className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:gap-10 sm:px-6">
          <p className="font-display w-20 shrink-0 text-5xl leading-none font-semibold tracking-tight">{factor(data.tier)}</p>
          <ol className="grid min-w-0 flex-1 grid-cols-3 gap-1.5" aria-label={`Level ${factor(data.tier)} of 1X, 2X and 5X`}>
            {STEPS.map((step) => {
              const reached = data.tier >= step.rank;
              return (
                <li key={step.rank} className="flex min-w-0 flex-col gap-2" aria-current={data.tier === step.rank ? "step" : undefined}>
                  <span
                    className={`h-2 rounded-full ${reached && data.tier > 0 ? "" : reached ? "bg-foreground" : "bg-muted"}`}
                    style={reached && data.tier > 0 ? { backgroundColor: PREMIER_RED } : undefined}
                  />
                  <span className={`truncate text-sm ${data.tier === step.rank ? "font-semibold" : "text-muted-foreground"}`}>
                    {step.factor} · {step.plan}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        {data.renewing ? <p className="text-muted-foreground border-border border-t px-5 py-3 text-sm sm:px-6">A renewal is being charged now.</p> : null}
        <ul className="divide-border border-border divide-y border-t">
          {sources(data).map((row) => (
            <li key={row.name} className="flex min-h-16 items-center gap-4 px-5 py-3 text-sm sm:px-6">
              <span className="text-muted-foreground w-14 shrink-0">{row.name}</span>
              <p className="min-w-0 flex-1">
                <span className={row.level ? "font-semibold" : "text-muted-foreground"}>{row.value}</span>
                {row.detail ? <span className="text-muted-foreground"> · {row.detail}</span> : null}
              </p>
              {row.level ? <span className="shrink-0 font-semibold tabular-nums">{row.level}</span> : null}
              {/* The same slot on both rows, so the levels line up in one column. */}
              <span className="flex w-24 shrink-0 justify-end">
                {row.name === "Plan" ? (
                  <Link
                    href={billingHref(placeId, {})}
                    className="border-border hover:bg-muted inline-flex h-9 items-center rounded-full border px-4 font-semibold"
                  >
                    Change
                  </Link>
                ) : null}
              </span>
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
