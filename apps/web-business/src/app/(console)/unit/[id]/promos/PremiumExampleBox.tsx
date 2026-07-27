import { Crown } from "lucide-react";
import { Section } from "@/components/shared";
import type { MyPlace } from "@/lib/api/places";
import {
  STRATEGY_BY_ID,
  UNIVERSAL_CAP_MXN,
  type StrategyId,
} from "@/lib/business/strategies";
import { formatMoney } from "@/lib/utils";
import { EXAMPLE_BILL_MXN } from "./promoConstants";

// Worked from the place's LIVE rate columns (not the preset), so custom or
// legacy rates preview exactly what the bill EF would apply today.
export function PremiumExampleBox({
  place,
  storedStrategy,
}: {
  place: MyPlace;
  storedStrategy: StrategyId | null;
}) {
  const hasPromo =
    place.welcome_premium_rate != null || place.premium_rate != null;
  const strategy = storedStrategy ? STRATEGY_BY_ID[storedStrategy] : null;
  const cap = place.monthly_promo_cap ?? UNIVERSAL_CAP_MXN;

  return (
    <Section
      title="What Premium & Magnetic guests get"
      description={`The current rates worked on a sample ${formatMoney(EXAMPLE_BILL_MXN, place.currency)} ticket.`}
      right={
        hasPromo ? (
          <span className="bg-muted text-foreground/70 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
            {strategy && strategy.id !== "zero"
              ? `${strategy.emoji} ${strategy.name}`
              : "Custom rates"}
          </span>
        ) : undefined
      }
    >
      {hasPromo ? (
        <>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <ExampleCard
              visit="Welcome"
              premiumRate={place.welcome_premium_rate}
              freeRate={place.welcome_free_rate}
              cap={cap}
              currency={place.currency}
            />
            <ExampleCard
              visit="Returning"
              premiumRate={place.premium_rate}
              freeRate={place.free_rate}
              cap={cap}
              currency={place.currency}
            />
          </div>
          <p className="text-muted-foreground text-[11px] leading-snug">
            Premium ≥ Standard in every Strategy — your Premium and Magnetic
            guests always get the better deal. They are what the membership
            buys.
          </p>
        </>
      ) : (
        <div className="border-border bg-muted/20 rounded-xl border border-dashed px-4 py-5 text-center">
          <p className="text-muted-foreground text-[12px] leading-snug">
            No promos right now — Premium guests see your place in the catalog
            with no discount card. Join a Strategy above to preview the deal.
          </p>
        </div>
      )}
    </Section>
  );
}

function ExampleCard({
  visit,
  premiumRate,
  freeRate,
  cap,
  currency,
}: {
  visit: string;
  premiumRate: number | null;
  freeRate: number | null;
  cap: number;
  currency: string;
}) {
  // The discount only touches the first `cap` of the ticket.
  const base = Math.min(EXAMPLE_BILL_MXN, cap);
  const saves =
    premiumRate == null ? 0 : Math.round((base * premiumRate) / 100);
  const pays = EXAMPLE_BILL_MXN - saves;
  const freeSaves = freeRate == null ? 0 : Math.round((base * freeRate) / 100);

  return (
    <div className="border-border bg-tier-premium/[0.04] rounded-xl border p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          {visit}
        </span>
        <span className="bg-tier-premium/10 text-tier-premium inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold">
          <Crown className="h-3 w-3" />
          Premium
        </span>
      </div>

      {premiumRate == null ? (
        <p className="text-muted-foreground mt-3 text-[12px]">
          No discount for this visit type.
        </p>
      ) : (
        <>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-tier-premium text-2xl leading-none font-bold tabular-nums">
              {premiumRate}%
            </span>
            <span className="text-muted-foreground text-[11px]">
              off the first {formatMoney(cap, currency)}
            </span>
          </div>
          <p className="text-foreground/80 mt-2 text-[12px]">
            {formatMoney(EXAMPLE_BILL_MXN, currency)} bill → pays{" "}
            <span className="font-bold">{formatMoney(pays, currency)}</span>
            <span className="text-muted-foreground">
              {" "}
              · saves {formatMoney(saves, currency)}
            </span>
          </p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            {freeRate == null
              ? "A Standard guest gets no discount on this visit."
              : `A Standard guest saves ${formatMoney(freeSaves, currency)} (${freeRate}%).`}
          </p>
        </>
      )}
    </div>
  );
}
