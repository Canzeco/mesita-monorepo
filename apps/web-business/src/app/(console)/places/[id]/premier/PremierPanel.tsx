// Premier's status card (MESITA-3632, Pato: "Make this Design cleaner"):
// one card, nothing to tap (MESITA-3204). The level is the page's anchor,
// "Level 2X" in the headline size, red above 1X; under it one line saying
// why (statusLine, lib/plans.ts: the plan, an Upgrade and at most one
// "then"); after a Stripe return, the Checkout outcome. The level and the
// line come from the same payload, so they never disagree. Every date and
// word is the server's or a shared constant (business-web-get-premier).

import type { PlacePremier } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { shownLevel, statusLine } from "@/lib/plans";
import { cn } from "@/lib/utils";

const LEVELS = ["1X", "2X", "5X"] as const;

const OUTCOME: Record<string, string> = {
  confirmed: "Your plan is on. Thank you.",
  declined: "The card was declined. Nothing was charged.",
  covered: "Mesita already gives this place that level. Nothing was charged.",
  pending: "Your payment is being confirmed. Reload in a minute to see it.",
  expired: "That checkout expired. Nothing was charged.",
  lost: "Someone else started a plan first. Nothing was charged.",
};

export function PremierPanel({ data, loadError }: { data: PlacePremier | null; loadError: string | null }) {
  if (!data) {
    return (
      <Card>
        <p className="font-semibold">Premier didn&apos;t load.</p>
        <p className="text-muted-foreground mt-1 text-sm">{loadError}</p>
      </Card>
    );
  }
  const level = LEVELS[shownLevel(data)];
  const outcome = data.outcome ? OUTCOME[data.outcome] : null;
  return (
    <Card>
      <p className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">Level</span>
        <span
          aria-label={`Level ${level}`}
          className={cn("font-display text-2xl font-semibold tracking-tight", level !== "1X" && "text-red-600")}
        >
          {level}
        </span>
      </p>
      <p className="text-muted-foreground mt-1 text-sm">{statusLine(data)}</p>
      {outcome ? <p className="mt-1 text-sm font-semibold">{outcome}</p> : null}
    </Card>
  );
}
