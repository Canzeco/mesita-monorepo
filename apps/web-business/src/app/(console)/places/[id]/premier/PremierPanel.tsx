"use client";

// Premier, as the place runs it (MESITA-3103): advertising. The place ranks
// higher on Home and the Map and wears an "Ad" mark; it never verifies the
// place and never promises views.
//
// Two sections (MESITA-3183, Pato: "just list the three boxes. as if it was a
// subscription"): Plan, the three plans to buy from (the same PlansCard Billing
// lists), and below it Boost, the temporary lift Mesita gives or a guest buys.
// The place runs at the higher of the two. Every amount and date is the
// server's (business-web-get-premier).

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelPremier, getPremier, type PlacePremier } from "@/lib/business-api";
import { PlansCard } from "@/components/billing/PlansCard";
import { Card } from "@/components/shell/Page";
import { placeTabHref } from "@/lib/routes";
import { ORIGIN_OF_SOURCE, REFILL_ORIGIN } from "@/lib/premier-origin";

const FACTOR: Record<number, string> = { 1: "2X", 2: "5X" };

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PremierPanel({ placeId, initial, loadError }: { placeId: string; initial: PlacePremier | null; loadError: string | null }) {
  const router = useRouter();
  const [data, setData] = useState<PlacePremier | null>(initial);
  // Stopping a guest changes the plans, so the boxes redraw from the new read.
  const [read, setRead] = useState(0);
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
    if (next.ok) {
      setData(next.data);
      setRead((n) => n + 1);
    } else setError(next.error);
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

  const boost = data.manual;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PlansCard key={read} placeId={placeId} initial={data} layout="boxes" backTo={placeTabHref(placeId, "premier")} />

      {data.renewing ? <p className="text-muted-foreground text-sm">A renewal is being charged now.</p> : null}

      {data.paid && !data.paid.by_you ? (
        <div className="flex items-center gap-4">
          <p className="text-muted-foreground min-w-0 flex-1 text-sm">A guest pays for this plan until {day(data.paid.ends_at)}.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => (armed ? void stopGuest() : setArmed(true))}
            onBlur={() => setArmed(false)}
            className="border-border hover:bg-muted h-9 shrink-0 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
          >
            {armed ? "Tap again to stop it" : "Stop it"}
          </button>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Boost</h2>
        <Card className="flex items-center gap-4 p-5 sm:p-5">
          {boost ? (
            <>
              <p className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{REFILL_ORIGIN[ORIGIN_OF_SOURCE[boost.source ?? "admin"] ?? "mesita"]}</span>
                <span className="text-muted-foreground"> · Until {day(boost.ends_at)}</span>
              </p>
              <span className="shrink-0 text-sm font-semibold tabular-nums">Premier {FACTOR[boost.tier]}</span>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">None</p>
          )}
        </Card>
      </section>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
