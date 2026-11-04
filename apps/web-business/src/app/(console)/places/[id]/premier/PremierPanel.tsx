// Premier, as the place reads it (MESITA-3204, Pato: "in premier just show the
// level, not interactive, interactive is by upgrading the billing ... just
// explain how it works"). One card with the level and a way to Billing, one that
// explains. Premier is advertising: the place ranks higher on Home and the Map
// and is marked as an ad; it never verifies the place and never promises views.
// The level and every date are the server's (business-web-get-premier).

import Link from "next/link";
import type { PlacePremier } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { billingHref } from "@/lib/routes";
import { ORIGIN_OF_SOURCE, REFILL_ORIGIN } from "@/lib/premier-origin";
import { planName } from "@/lib/plans";

const LEVEL: Record<number, string> = { 0: "1X", 1: "2X", 2: "5X" };

const HOW_IT_WORKS: Array<{ name: string; line: string }> = [
  {
    name: "Visibility",
    line: "Your level multiplies your place's score on Home and the Map. 1X is where every place starts, 2X doubles the score and 5X multiplies it by five.",
  },
  {
    name: "What it changes",
    line: "A higher score moves your place up among the places a guest is already looking at. It doesn't guarantee more views.",
  },
  {
    name: "Where your level comes from",
    line: "Your plan in Billing, or an Upgrade, which lasts a set time and which Mesita can give or a guest can buy. Your place runs at the higher of the two; they don't add up.",
  },
  {
    name: "What guests see",
    line: "A red Premier mark with your level after your name, a red pin on the Map and Ad on Home. Premier is advertising, so it never verifies your place.",
  },
];

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** What the level runs on right now, in one line. */
function source({ tier, manual, paid }: PlacePremier): string {
  if (manual && manual.tier === tier && tier > 0 && (!paid || manual.tier > paid.tier)) {
    const origin = REFILL_ORIGIN[ORIGIN_OF_SOURCE[manual.source ?? "admin"] ?? "mesita"];
    return `Upgrade · ${origin} · Until ${day(manual.ends_at)}`;
  }
  return `${planName(paid?.tier)} plan`;
}

export function PremierPanel({ placeId, data, loadError }: { placeId: string; data: PlacePremier | null; loadError: string | null }) {
  if (!data) {
    return (
      <Card>
        <p className="font-semibold">Premier didn&apos;t load.</p>
        <p className="text-muted-foreground mt-1 text-sm">{loadError}</p>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-4 pb-8">
      <Card className="p-0 sm:p-0">
        <div className="flex min-h-16 items-center gap-4 px-5 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{LEVEL[data.tier] ?? "1X"} visibility</p>
            <p className="text-muted-foreground text-sm">{source(data)}</p>
          </div>
          <Link
            href={billingHref(placeId)}
            className="border-border hover:bg-muted inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-semibold"
          >
            Billing
          </Link>
        </div>
      </Card>
      <Card className="flex flex-col p-0 sm:p-0">
        <h2 className="px-5 pt-4 pb-2 font-semibold sm:px-6">How it works</h2>
        <ul className="divide-border divide-y">
          {HOW_IT_WORKS.map((row) => (
            <li key={row.name} className="px-5 py-3 text-sm sm:px-6">
              <p className="font-medium">{row.name}</p>
              <p className="text-muted-foreground">{row.line}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
