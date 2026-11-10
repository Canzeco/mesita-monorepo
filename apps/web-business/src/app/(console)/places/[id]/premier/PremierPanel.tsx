// Premier, as the place reads it (MESITA-3204: "just show the level, not
// interactive, interactive is by upgrading the billing"). MESITA-3606 (Pato:
// "keep it simple. don't overexplain"): one card of three rows, Level (1X · 2X
// · 5X, the place's lit), Plan (with Billing) and Upgrade, and one line under
// it. Premier is advertising; it never verifies the place. The level and every
// date are the server's (business-web-get-premier).

import Link from "next/link";
import { ArrowFatUpIcon, CrownIcon, MegaphoneIcon } from "@phosphor-icons/react/dist/ssr";
import type { PlacePremier } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { billingHref } from "@/lib/routes";
import { ORIGIN_OF_SOURCE, REFILL_ORIGIN } from "@/lib/premier-origin";
import { planName } from "@/lib/plans";
import { cn } from "@/lib/utils";

const LEVELS = ["1X", "2X", "5X"] as const;

const ROW = "grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 text-sm sm:px-6";
const MARK = "grid size-10 shrink-0 place-items-center rounded-xl";
const RED = "bg-red-100 text-red-600";
const GREY = "bg-muted text-muted-foreground";

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  const level = Math.min(Math.max(data.tier, 0), LEVELS.length - 1);
  const upgrade = data.manual && data.manual.tier > 0 ? data.manual : null;
  const origin = upgrade ? REFILL_ORIGIN[ORIGIN_OF_SOURCE[upgrade.source ?? "admin"] ?? "mesita"] : null;
  return (
    <div className="flex flex-col gap-3 pb-8">
      <Card className="p-0 sm:p-0">
        <ul className="divide-border divide-y">
          <li className={ROW} data-premier="level">
            <span className={cn(MARK, level > 0 ? RED : GREY)}>
              <MegaphoneIcon size={22} weight={level > 0 ? "fill" : "regular"} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-medium">Level</p>
              <p className="text-muted-foreground">Your place&apos;s score on Home and the Map is multiplied by this.</p>
            </div>
            <div className="flex gap-1.5" aria-label={`Level ${LEVELS[level]}`}>
              {LEVELS.map((l, i) => (
                <span
                  key={l}
                  className={cn("rounded-full px-3 py-1.5 text-xs font-bold", i === level ? "bg-red-600 text-white" : "bg-muted text-muted-foreground")}
                >
                  {l}
                </span>
              ))}
            </div>
          </li>
          <li className={cn(ROW, "grid-cols-[auto_minmax(0,1fr)_auto_auto]")} data-premier="plan">
            <span className={cn(MARK, GREY)}>
              <CrownIcon size={22} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-medium">Plan</p>
              <p className="text-muted-foreground">Free 1X · Pro 2X · Max 5X</p>
            </div>
            <p className="font-semibold whitespace-nowrap">{planName(data.paid?.tier)}</p>
            <Link
              href={billingHref(placeId)}
              className="border-border hover:bg-muted inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-semibold"
            >
              Billing
            </Link>
          </li>
          <li className={ROW} data-premier="upgrade">
            <span className={cn(MARK, upgrade ? RED : GREY)}>
              <ArrowFatUpIcon size={22} weight={upgrade ? "fill" : "regular"} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-medium">Upgrade</p>
              <p className="text-muted-foreground">
                {upgrade ? `${origin} · Until ${day(upgrade.ends_at)}` : "A level for a set time, from Mesita or a guest."}
              </p>
            </div>
            <p className={cn("font-semibold whitespace-nowrap", !upgrade && "text-muted-foreground")}>
              {upgrade ? (LEVELS[upgrade.tier] ?? "") : "None"}
            </p>
          </li>
        </ul>
      </Card>
      <p className="text-muted-foreground px-1 text-sm">Your place runs at the higher of Plan and Upgrade.</p>
    </div>
  );
}
