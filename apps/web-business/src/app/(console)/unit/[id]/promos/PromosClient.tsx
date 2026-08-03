"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Section } from "@/components/shared";
import { apiUpdatePlace, type MyPlace } from "@/lib/api/places";
import { apiChangeSubscription } from "@/lib/api/subscription";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  STRATEGIES,
  STRATEGY_BY_ID,
  UNIVERSAL_CAP_MXN,
  strategyForPlace,
  type StrategyId,
} from "@/lib/business/strategies";
import { errMsg, formatMoney } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { PremiumExampleBox } from "./PremiumExampleBox";
import { PricingCard } from "./PricingCard";
import { ProductModal } from "./ProductModal";
import { PRODUCT_PRICE_MXN } from "./promoConstants";
import { StatusPill } from "./promoShared";
import { SubscriptionBox } from "./SubscriptionBox";

// Promos — v4.1 pricing cards + product modal (mirrors admin MESITA-584).
//   1. Subscription — FOUR pricing cards with generated art bands. The whole
//      card is the click target: it opens a product modal with the full
//      detail (what you give / what you get back / the commitment) and the
//      action footer — the modal IS the confirm-and-pay step. Four products
//      cost the SAME MX$1,000/year Verified membership; switching Strategies
//      later is a NEW membership (the lock-in).
//   2. The subscription — fee framing, activation steps, strikes ladder.
//   3. Premium example — what the current rates feel like at the bill.
//
// Plan is billing-locked: Join calls business-web-change-subscription
// (Verified = plan=pro, MX$1,000/yr). Mock mode grants instantly; real mode
// redirects to Stripe Checkout (MOCK_SUBSCRIPTION flip = MESITA-37). After
// pay, staff WhatsApp activation still applies (MESITA-542). A subscribed
// place switches rates directly (rates + cap only, never plan). Drop to Zero
// downgrades membership via the same billing EF.

// A place on any product carries a subscription (plan != free).
function isSubscribed(place: MyPlace): boolean {
  return place.plan !== "free";
}

export function PromosClient({ place }: { place: MyPlace }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  const subscribed = isSubscribed(place);

  // The product the stored rates currently reflect (null = custom/legacy).
  const storedStrategy = strategyForPlace(place);
  const [selectedId, setSelectedId] = useState<StrategyId | null>(
    storedStrategy,
  );
  const [pendingId, setPendingId] = useState<StrategyId | null>(null);
  const [modalId, setModalId] = useState<StrategyId | null>(null);
  // Paid product joined by a not-yet-subscribed place → WhatsApp activation notice.
  const [activationFor, setActivationFor] = useState<StrategyId | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promosOrigin =
    typeof window !== "undefined" ? window.location.origin : "";

  // Writes the four rate columns + the cap atomically (never plan — that is
  // billing). Optimistic: the card flips immediately and reverts on failure.
  const commitStrategy = (target: StrategyId) => {
    setModalId(null);
    if (pendingId || target === selectedId) return;
    const strat = STRATEGY_BY_ID[target];
    const previous = selectedId;
    setSelectedId(target);
    setPendingId(target);
    setError(null);
    void apiUpdatePlace(supabase, {
      id: place.id,
      welcome_free_rate: strat.rates.welcome_free_rate,
      welcome_premium_rate: strat.rates.welcome_premium_rate,
      free_rate: strat.rates.free_rate,
      premium_rate: strat.rates.premium_rate,
      monthly_promo_cap: strat.cap,
    })
      .then(() => router.refresh())
      .catch((err) => {
        setSelectedId(previous);
        setError(errMsg(err, "Couldn't save the Strategy."));
      })
      .finally(() => setPendingId(null));
  };

  // Join Verified (or drop to Free) via billing EF, then write rates.
  const runBillingThenRates = async (
    target: StrategyId,
    plan: "pro" | "free",
  ) => {
    if (billingBusy || pendingId) return;
    setBillingBusy(true);
    setError(null);
    const previous = selectedId;
    try {
      const result = await apiChangeSubscription(supabase, {
        projectId: place.id,
        plan,
        successUrl: `${promosOrigin}/unit/${place.id}/promos?subscription=success`,
        cancelUrl: `${promosOrigin}/unit/${place.id}/promos?subscription=cancelled`,
      });
      // Real Stripe Checkout — leave the page; rates land after webhook + return.
      if (
        result.checkout_url &&
        !result.mock &&
        !result.already_subscribed &&
        !result.plan_switched &&
        !result.scheduled_downgrade &&
        plan === "pro"
      ) {
        window.location.href = result.checkout_url;
        return;
      }
      if (plan === "pro") setActivationFor(target);
      setModalId(null);
      // Force rate write even when selectedId already matches (first Join).
      const strat = STRATEGY_BY_ID[target];
      setSelectedId(target);
      setPendingId(target);
      await apiUpdatePlace(supabase, {
        id: place.id,
        welcome_free_rate: strat.rates.welcome_free_rate,
        welcome_premium_rate: strat.rates.welcome_premium_rate,
        free_rate: strat.rates.free_rate,
        premium_rate: strat.rates.premium_rate,
        monthly_promo_cap: strat.cap,
      });
      router.refresh();
      setPendingId(null);
    } catch (err) {
      setSelectedId(previous);
      setError(errMsg(err, "Couldn't update the membership."));
      setPendingId(null);
    } finally {
      setBillingBusy(false);
    }
  };

  const onJoinOrSwitch = (target: StrategyId) => {
    const paid = target !== "zero";
    if (paid && !subscribed) {
      void runBillingThenRates(target, "pro");
      return;
    }
    if (!paid && subscribed) {
      void runBillingThenRates(target, "free");
      return;
    }
    commitStrategy(target);
  };

  const modalStrategy = modalId ? STRATEGY_BY_ID[modalId] : null;
  const activationStrategy = activationFor
    ? STRATEGY_BY_ID[activationFor]
    : null;

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-10">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Promos
        </h2>
        <p className="text-muted-foreground text-[13px] leading-snug">
          Four memberships, one price — what changes is the discounts you give,
          and the visibility the algorithm gives back.
        </p>
      </header>

      {/* ── Box 1 · Subscription (four pricing cards) ─────────────────── */}
      <Section
        title="Mesita Membership"
        description={`${formatMoney(PRODUCT_PRICE_MXN, place.currency)}/year each for the paid three — tap a card for the full detail. Every discount applies to the first ${formatMoney(UNIVERSAL_CAP_MXN, place.currency)} of the bill.`}
        right={<StatusPill subscribed={subscribed} />}
      >
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          {STRATEGIES.map((s) => (
            <PricingCard
              key={s.id}
              strategy={s}
              currency={place.currency}
              selected={s.id === selectedId}
              pending={pendingId === s.id}
              subscribed={subscribed}
              onOpen={() => setModalId(s.id)}
            />
          ))}
        </div>

        {activationStrategy && (
          <p className="rounded-xl bg-emerald-50 p-3 text-[12px] leading-snug text-emerald-800">
            Verified membership started for{" "}
            <span className="font-semibold">
              {activationStrategy.emoji} {activationStrategy.name}
            </span>{" "}
            ({formatMoney(PRODUCT_PRICE_MXN, place.currency)}/year). Mesita will
            reach out on your staff WhatsApp to run the test ping — guests
            redeem after activation.
          </p>
        )}

        {selectedId === null && (
          <p className="text-muted-foreground text-[11px]">
            Your current rates don&apos;t match a Strategy — pick one to
            standardize them.
          </p>
        )}

        <p className="text-muted-foreground text-[11px] leading-snug">
          Same price on every Strategy keeps rank off the market — you buy a
          commitment to give, not placement. Switching Strategies later is a new{" "}
          {formatMoney(PRODUCT_PRICE_MXN, place.currency)}/year membership.
        </p>

        {error && <p className={ERROR_BOX_CLASS}>{error}</p>}
      </Section>

      {/* ── Box 2 · The subscription (fee, activation, strikes) ──────── */}
      <SubscriptionBox currency={place.currency} place={place} />

      {/* ── Box 3 · Premium guest example ─────────────────────────────── */}
      <PremiumExampleBox place={place} storedStrategy={storedStrategy} />

      {modalStrategy && (
        <ProductModal
          strategy={modalStrategy}
          currency={place.currency}
          isCurrent={modalStrategy.id === selectedId}
          subscribed={subscribed}
          billingBusy={billingBusy || pendingId === modalStrategy.id}
          onCommit={() => onJoinOrSwitch(modalStrategy.id)}
          onClose={() => setModalId(null)}
        />
      )}
    </div>
  );
}
