"use client";

// Premier, as the place runs it (MESITA-3103): advertising. The place ranks
// higher on Home and the Map and wears an "Ad" mark; it never verifies the
// place and never promises views.
//
// Since MESITA-3173 Premier is not sold on its own: it comes with the Business
// plans (Mesita Business Pro = Premier 2X, Ultra = Premier 5X), which Billing
// lists. This page is one card: the level running now, then where to get it.
// Every amount and date is the server's (business-web-get-premier).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelPremier, getPremier, type PlacePremier } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { billingHref, placeTabHref } from "@/lib/routes";
import { ORIGIN_OF_SOURCE, REFILL_ORIGIN } from "@/lib/premier-origin";
import { PLAN_NAME } from "@/lib/plans";

const LABEL_BY_RANK: Record<number, string> = { 1: "Premier 2X", 2: "Premier 5X" };
const levelLabel = (tier: number) => LABEL_BY_RANK[tier] ?? "Premier";

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
    parts.push(`${levelLabel(data.paid.tier)} with ${data.paid.by_you ? "your plan" : "a guest's payment"} · ${data.paid.renews ? "renews" : "ends"} ${day(data.paid.ends_at)}`);
  }
  if (data.renewing) parts.push("A renewal is being charged now");
  return `${parts.join(". ")}.`;
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
          <p className="font-semibold">{data.tier > 0 ? levelLabel(data.tier) : "Not Premier"}</p>
          {data.tier > 0 || data.renewing ? <p className="text-muted-foreground text-sm">{summary(data)}</p> : null}
        </div>
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
            Comes with {PLAN_NAME.boost_2x} (2X) and {PLAN_NAME.boost_5x} (5X).
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
