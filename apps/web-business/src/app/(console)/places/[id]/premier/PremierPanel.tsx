"use client";

// Premier, as the place runs it (MESITA-3103): advertising. The place ranks
// higher on Home and the Map and is marked as an ad; it never verifies the
// place and never promises views.
//
// One card of two rows (MESITA-3186, Pato: "the plans go into billing. In
// premier put far less information"): the plan, with Change going to Billing,
// and the Upgrade. The place runs at the higher of the two. Every date is the
// server's (business-web-get-premier).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelPremier, getPremier, type PlacePremier } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { billingHref, placeTabHref } from "@/lib/routes";
import { ORIGIN_OF_SOURCE, REFILL_ORIGIN } from "@/lib/premier-origin";
import { planName } from "@/lib/plans";

const FACTOR: Record<number, string> = { 1: "2X", 2: "5X" };

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const rowClass = "flex min-h-16 items-center gap-4 px-5 py-3 sm:px-6";
const labelClass = "text-muted-foreground w-14 shrink-0";

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

  const { paid, manual: boost } = data;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Card className="p-0 sm:p-0">
        <ul className="divide-border divide-y">
          <li className={rowClass}>
            <span className={labelClass}>Plan</span>
            <p className="min-w-0 flex-1 font-semibold">
              {planName(paid?.tier)}
              {paid ? ` · ${FACTOR[paid.tier]}` : ""}
            </p>
            <Link href={billingHref(placeId)} className="border-border hover:bg-muted inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-semibold">
              Change
            </Link>
          </li>
          <li className={rowClass}>
            <span className={labelClass}>Upgrade</span>
            {boost ? (
              <p className="min-w-0 flex-1">
                <span className="font-semibold">
                  {REFILL_ORIGIN[ORIGIN_OF_SOURCE[boost.source ?? "admin"] ?? "mesita"]} · {FACTOR[boost.tier]}
                </span>
                <span className="text-muted-foreground"> · Until {day(boost.ends_at)}</span>
              </p>
            ) : (
              <p className="text-muted-foreground min-w-0 flex-1">None</p>
            )}
          </li>
          {paid && !paid.by_you ? (
            <li className={rowClass}>
              <p className="text-muted-foreground min-w-0 flex-1">A guest pays for this plan until {day(paid.ends_at)}.</p>
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
