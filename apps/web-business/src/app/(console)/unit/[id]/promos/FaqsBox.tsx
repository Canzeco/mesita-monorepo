import { ChevronDown, Crown } from "lucide-react";
import { Section } from "@/components/shared";
import type { MyPlace } from "@/lib/api/places";
import {
  STRATEGY_BY_ID,
  UNIVERSAL_CAP_MXN,
  type StrategyId,
} from "@/lib/business/strategies";
import { cn, formatMoney } from "@/lib/utils";
import { EXAMPLE_BILL_MXN, PRODUCT_PRICE_MXN } from "./promoConstants";

function Faq({
  q,
  defaultOpen,
  children,
}: {
  q: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="border-border/60 group rounded-xl border"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="text-muted-foreground flex flex-col gap-2.5 px-3.5 pb-3.5 text-[12px] leading-relaxed">
        {children}
      </div>
    </details>
  );
}

export function FaqsBox({
  place,
  storedStrategy,
  member,
}: {
  place: MyPlace;
  storedStrategy: StrategyId | null;
  member: boolean;
}) {
  const price = formatMoney(PRODUCT_PRICE_MXN, place.currency);
  const cap = formatMoney(UNIVERSAL_CAP_MXN, place.currency);
  const exampleSavesMxn = UNIVERSAL_CAP_MXN * 0.5;

  return (
    <Section
      title="FAQs"
      description="How membership and strategy work — with real numbers."
    >
      <div className="flex flex-col gap-2">
        <Faq q="What does a Premium guest actually get?" defaultOpen>
          <PremiumExamples place={place} storedStrategy={storedStrategy} />
        </Faq>

        <Faq q={`What exactly does the ${price}/year buy?`}>
          <p>
            One Mesita Membership — a commitment filter, not a feature tier. It
            keeps half-hearted restaurants out of the rewards program. Being a
            member unlocks the paid strategies and turns on your discounts.
            Being listed on Mesita never costs anything.
          </p>
        </Faq>

        <Faq q="Can I switch strategies?">
          <p>
            Yes — free, anytime, while your membership is active. Strategy is
            the discount posture you promise guests; switching only changes
            your rates. New tickets pick up the new rates; open tickets keep
            what they were created with.
          </p>
        </Faq>

        <Faq q="What is Zero for members?">
          <p>
            Zero pauses discounts — your membership stays active, but the promo
            lane closes and visibility drops to Low. Cancelling membership is a
            separate action in the Membership box.
          </p>
        </Faq>

        <Faq q="How does visibility work?">
          <p>
            Zero sits at Low, Conservative at Mid, Aggressive at High and
            Dominant at Max. Visibility rises with what you give — it is never
            a separate knob you can buy.
          </p>
        </Faq>

        <Faq q={`What is the ${cap} cap?`}>
          <p>
            Every discount applies only to the first {cap} of the bill. Example:
            50% off a {formatMoney(EXAMPLE_BILL_MXN, place.currency)} bill
            touches the first {cap}, so the guest saves{" "}
            {formatMoney(exampleSavesMxn, place.currency)}.
          </p>
        </Faq>

        <Faq q="How do I cancel membership?">
          <p>
            Use Drop membership in the Membership box.{" "}
            {member ? "You are currently a member." : "You are not currently a member."}
          </p>
        </Faq>

        <Faq q="What happens if a guest is turned away?">
          <p>
            1 — warning · 2 — discounts paused 30 days · 3 — membership
            forfeited (place stays listed). Strikes decay after 6 months clean.
          </p>
        </Faq>
      </div>
    </Section>
  );
}

function PremiumExamples({
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

  if (!hasPromo) {
    return (
      <div className="border-border bg-muted/20 rounded-xl border border-dashed px-4 py-4 text-center">
        <p className="text-[12px] leading-snug">
          No promos right now — Premium guests see your place with no discount
          card. Pick a strategy above to preview the deal.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-foreground/80">
          Current rates on a sample{" "}
          {formatMoney(EXAMPLE_BILL_MXN, place.currency)} ticket:
        </p>
        <span className="bg-muted text-foreground/70 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
          {strategy
            ? `${strategy.emoji} ${strategy.name}`
            : "Custom rates"}
        </span>
      </div>
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
      <p>
        Premium ≥ Standard in every strategy — Premium guests always get the
        better deal.
      </p>
    </>
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
