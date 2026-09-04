import { ChevronDown, Crown } from "lucide-react";
import { Section } from "@/components/shared";
import type { MyPlace } from "@/lib/api/places";
import {
  DEFAULT_DISCOUNT_CAP_MXN,
  DISCOUNT_CAPS_MXN,
  STRATEGY_BY_ID,
  type StrategyId,
} from "@/lib/business/strategies";
import {
  RATE_MAX,
  type PlanKey,
  type PromosConfig,
  type StrategyKey,
} from "@/lib/business/promos";
import { formatMoney } from "@/lib/utils";
import { EXAMPLE_BILL_MXN, PRODUCT_PRICE_MXN } from "./promoConstants";

// Native details/summary accordion row — no state, keyboard-accessible.
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
    <details open={defaultOpen} className="group">
      <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[12.5px] font-semibold transition [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="text-muted-foreground flex flex-col gap-2 px-3.5 pb-3.5 text-[12px] leading-relaxed">
        {children}
      </div>
    </details>
  );
}

export function FaqsBox({
  place,
  storedStrategy,
  member,
  cfg,
}: {
  place: MyPlace;
  storedStrategy: StrategyId | null;
  member: boolean;
  cfg: PromosConfig;
}) {
  const price = formatMoney(PRODUCT_PRICE_MXN, place.currency);
  const capMxn = place.monthly_promo_cap ?? DEFAULT_DISCOUNT_CAP_MXN;
  const cap = formatMoney(capMxn, place.currency);
  const exampleSavesMxn = capMxn * 0.5;
  const capOptions = DISCOUNT_CAPS_MXN.map((n) =>
    formatMoney(n, place.currency),
  ).join(" / ");

  return (
    <Section
      title="FAQs"
      description="How Partnership and strategy work — with real numbers."
    >
      {/* One divided list, everything closed: the answers are reference, not
          reading. The worked example opens first because it is the only one
          that shows this place's own numbers. */}
      <div className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-xl border">
        <Faq q="What does a Premium guest actually get?" defaultOpen>
          <PremiumExamples
            place={place}
            storedStrategy={storedStrategy}
            cfg={cfg}
          />
        </Faq>

        <Faq q={`What exactly does the ${price}/year buy?`}>
          <p>
            Partnership. Conservative and Aggressive unlock after you join —
            pick either, switch free anytime. Zero stays selectable with no
            discounts. Being listed on Mesita never costs anything. The fee is a
            commitment filter, not a rank you can buy.
          </p>
        </Faq>

        <Faq q="Can I switch strategies — or move to Zero?">
          <p>
            Yes — free, anytime, while Partnership is active. Strategy is
            the discount posture you promise guests; switching only changes your
            rates. New tickets pick up the new rates; open tickets keep what
            they were created with.
          </p>
          <p>
            Switching to Zero pauses discounts: Partnership stays active,
            but the promo lane closes and visibility drops to Low. Dropping
            Partnership is a separate action on this page.
          </p>
        </Faq>

        <Faq q="How does visibility work?">
          <p>
            Zero sits at Low, Conservative at Mid, Aggressive at High.
            Visibility rises with what you give — it is never
            a separate knob you can buy.
          </p>
        </Faq>

        <Faq q="What is the discount cap?">
          <p>
            Independent of strategy — choose {capOptions}. Every discount
            applies only to the first portion of the bill, up to your cap.
            Example on your current {cap} cap: 50% off a{" "}
            {formatMoney(EXAMPLE_BILL_MXN, place.currency)} bill touches the
            first {cap}, so the guest saves{" "}
            {formatMoney(exampleSavesMxn, place.currency)}.
          </p>
        </Faq>

        <Faq q="How do I cancel Partnership?">
          <p>
            Use Drop Partnership on the bar at the top of this page.{" "}
            {member
              ? "You currently hold Partnership."
              : "You do not currently hold Partnership."}
          </p>
        </Faq>

        <Faq q="What happens if a guest is turned away?">
          <p>
            1 — warning · 2 — discounts paused 30 days · 3 — Partnership
            forfeited (place stays listed). Strikes decay after 6 months clean.
          </p>
        </Faq>
      </div>
    </Section>
  );
}

// MESITA-1001: this used to compute from the place's `*_rate` COLUMNS. The
// engine went additive-v10 (MESITA-992) and stopped reading them — they only
// carry strategy IDENTITY now — so the example quoted pre-v10 numbers. On
// Aggressive that under-reported returning visits by 10 points. Read the live
// config, exactly like the engine does.
function PremiumExamples({
  place,
  storedStrategy,
  cfg,
}: {
  place: MyPlace;
  storedStrategy: StrategyId | null;
  cfg: PromosConfig;
}) {
  const paidStrategy =
    storedStrategy && storedStrategy !== "zero"
      ? (storedStrategy as StrategyKey)
      : null;
  const strategy = storedStrategy ? STRATEGY_BY_ID[storedStrategy] : null;
  const cap = place.monthly_promo_cap ?? DEFAULT_DISCOUNT_CAP_MXN;

  // Welcome is the automatic first-ticket bonus; returning is the bare base.
  // The two example cards are the PLAN axis (v11) at the base class: what the
  // same Bronze guest pays on Free versus on the paid subscription.
  const rate = (plan: PlanKey, welcome: boolean) =>
    paidStrategy
      ? Math.min(
          RATE_MAX,
          cfg.visits.base[paidStrategy].bronze[plan] +
            (welcome ? cfg.visits.bonuses[paidStrategy].welcome : 0),
        )
      : null;

  if (!paidStrategy) {
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
          {strategy ? `${strategy.emoji} ${strategy.name}` : "Custom rates"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
        <ExampleCard
          visit="Welcome"
          premiumRate={rate("premium", true)}
          freeRate={rate("free", true)}
          cap={cap}
          currency={place.currency}
        />
        <ExampleCard
          visit="Returning"
          premiumRate={rate("premium", false)}
          freeRate={rate("free", false)}
          cap={cap}
          currency={place.currency}
        />
      </div>
      <p>
        Premium ≥ Free in every strategy — Premium guests always get the
        better deal. Action bonuses (Instagram Story, Google Review, Mesita
        Review) stack on top of these.
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
              ? "A Free guest gets no discount on this visit."
              : `A Free guest saves ${formatMoney(freeSaves, currency)} (${freeRate}%).`}
          </p>
        </>
      )}
    </div>
  );
}
