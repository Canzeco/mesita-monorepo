"use client";

// Rewards — what a place GIVES BACK, priced by the place.
//
// IT IS A MONEY PRODUCT, and that is why it sits beside Payments and Credits
// rather than beside Visits. Visits is the container guests arrive through;
// Rewards is the dial. The two were folded into one screen once and the dial
// ended up living in the container's settings, where nobody could find it.
//
// REWARDS ARE VISIT-ONLY. A reward is earned by showing up and closing a bill,
// never by placing an order — an order is prepaid and has no table to reward.
import { useState } from "react";
import { Check } from "lucide-react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Tiles } from "@/components/shared/Tiles";
import { SoonStrip } from "@/components/shared/SoonStrip";
import { VISITS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import { money } from "@/lib/format";
import { CTA_BUTTON_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const STRATEGIES = [
  {
    id: "zero",
    name: "Off",
    rate: 0,
    blurb: "No reward. The place is listed, discoverable and reviewed, and gives nothing back.",
  },
  {
    id: "conservative",
    name: "Conservative",
    rate: 5,
    blurb: "5% back on the bill. Enough for a guest to notice, small enough not to move the margin much.",
  },
  {
    id: "aggressive",
    name: "Aggressive",
    rate: 12,
    blurb: "12% back. For a new place buying its first hundred regulars, or a slow night you want filled.",
  },
] as const;

export function RewardsView() {
  const place = useHeldPlace();
  const { scenario } = useMock();
  const [picked, setPicked] = useState(place.visitRewards ? "conservative" : "zero");
  const visits = listFor(VISITS.filter((v) => v.placeId === place.id), scenario);
  const given = visits.reduce((n, v) => n + v.rewardCents, 0);

  return (
    <div className="flex flex-col gap-4">
      <Tiles
        tiles={[
          { label: "Rewards", value: place.visitRewards ? "On" : "Off" },
          { label: "Rate", value: `${STRATEGIES.find((s) => s.id === picked)?.rate ?? 0}%` },
          {
            label: "Given back",
            value: visits.length ? money(given) : null,
            hint: "Across the visits on the Visits view",
          },
          {
            label: "Rewarded visits",
            value: visits.filter((v) => v.rewardCents > 0).length || null,
          },
        ]}
      />

      <Section
        title="What this place gives back"
        description="One dial, on the visit. Pick the rate and it applies to the next bill closed here — nothing retroactive, ever."
        lane
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {STRATEGIES.map((s) => {
            const on = s.id === picked;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(s.id)}
                className={cn(
                  "focus-visible:ring-ring rounded-2xl border p-4 text-left outline-hidden transition focus-visible:ring-2",
                  on
                    ? "border-foreground bg-foreground/[0.03] shadow-card"
                    : "border-border hover:border-foreground/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={TINY_LABEL_CLASS}>{s.name}</p>
                  {on && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                </div>
                <p className="font-display mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                  {s.rate}%
                </p>
                <p className="text-muted-foreground mt-1 text-[12px] leading-snug">{s.blurb}</p>
              </button>
            );
          })}
        </div>
        <button type="button" className={cn(CTA_BUTTON_CLASS, "self-start")}>
          Save the rate
        </button>
      </Section>

      <SoonStrip title="Rewards on orders is not a thing, and will not be">
        A reward is earned by turning up. An order is prepaid and has no table,
        so there is nothing to reward and nobody standing there to see it
        happen. Use Credits for the prepaid case.
      </SoonStrip>
    </div>
  );
}
