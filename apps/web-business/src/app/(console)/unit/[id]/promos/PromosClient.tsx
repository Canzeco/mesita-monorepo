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
  strategyForPlace,
  type StrategyId,
} from "@/lib/business/strategies";
import { errMsg } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { FaqsBox } from "./FaqsBox";
import { MembershipBox } from "./MembershipBox";
import { PricingCard } from "./PricingCard";
import { ProductModal } from "./ProductModal";
import { membershipPillState } from "./promoShared";
import { isCardCurrent } from "./promo-state";

// Promos — three boxes (MESITA-912 membership unbundle):
//   1. Membership — fee, status pill, join/drop, activation, strikes.
//   2. Strategy — four cards (give/receive, no price). Non-members: locked,
//      tap routes to join with that strategy preselected. Members: switch =
//      rates-only (apiUpdatePlace).
//   3. FAQs — how the model works, Premium worked example under CURRENT strategy.

function isSubscribed(place: MyPlace): boolean {
  return place.plan !== "free";
}

function strategyRates(target: StrategyId) {
  const strat = STRATEGY_BY_ID[target];
  return {
    welcome_free_rate: strat.rates.welcome_free_rate,
    welcome_premium_rate: strat.rates.welcome_premium_rate,
    free_rate: strat.rates.free_rate,
    premium_rate: strat.rates.premium_rate,
    monthly_promo_cap: strat.cap,
  };
}

export function PromosClient({ place }: { place: MyPlace }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  const subscribed = isSubscribed(place);
  const pillState = membershipPillState(place);
  const forfeited = pillState === "forfeited";
  const joinDisabled = forfeited;

  const storedStrategy = strategyForPlace(place);
  const [selectedId, setSelectedId] = useState<StrategyId | null>(
    storedStrategy,
  );
  const [pendingId, setPendingId] = useState<StrategyId | null>(null);
  const [modalId, setModalId] = useState<StrategyId | null>(null);
  const [activationFor, setActivationFor] = useState<StrategyId | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promosOrigin =
    typeof window !== "undefined" ? window.location.origin : "";

  const commitSwitch = (target: StrategyId) => {
    setModalId(null);
    if (pendingId || !subscribed || target === selectedId) return;
    const previous = selectedId;
    setSelectedId(target);
    setPendingId(target);
    setError(null);
    void apiUpdatePlace(supabase, { id: place.id, ...strategyRates(target) })
      .then(() => router.refresh())
      .catch((err) => {
        setSelectedId(previous);
        setError(errMsg(err, "Couldn't save the Strategy."));
      })
      .finally(() => setPendingId(null));
  };

  const commitJoin = async (target: StrategyId) => {
    if (billingBusy || pendingId || subscribed || joinDisabled) return;
    setBillingBusy(true);
    setError(null);
    const previous = selectedId;
    try {
      const result = await apiChangeSubscription(supabase, {
        projectId: place.id,
        plan: "pro",
        successUrl: `${promosOrigin}/unit/${place.id}/promos?subscription=success`,
        cancelUrl: `${promosOrigin}/unit/${place.id}/promos?subscription=cancelled`,
      });
      if (
        result.checkout_url &&
        !result.mock &&
        !result.already_subscribed &&
        !result.plan_switched &&
        !result.scheduled_downgrade
      ) {
        window.location.href = result.checkout_url;
        return;
      }
      setActivationFor(target);
      setModalId(null);
      setSelectedId(target);
      setPendingId(target);
      await apiUpdatePlace(supabase, {
        id: place.id,
        ...strategyRates(target),
      });
      router.refresh();
    } catch (err) {
      setSelectedId(previous);
      setError(errMsg(err, "Couldn't start membership."));
    } finally {
      setPendingId(null);
      setBillingBusy(false);
    }
  };

  const commitDrop = async () => {
    if (billingBusy || pendingId || !subscribed) return;
    setBillingBusy(true);
    setError(null);
    const previous = selectedId;
    try {
      const result = await apiChangeSubscription(supabase, {
        projectId: place.id,
        plan: "free",
        successUrl: `${promosOrigin}/unit/${place.id}/promos?subscription=success`,
        cancelUrl: `${promosOrigin}/unit/${place.id}/promos?subscription=cancelled`,
      });
      if (result.checkout_url && !result.mock) {
        window.location.href = result.checkout_url;
        return;
      }
      setSelectedId("zero");
      setPendingId("zero");
      await apiUpdatePlace(supabase, {
        id: place.id,
        ...strategyRates("zero"),
      });
      router.refresh();
    } catch (err) {
      setSelectedId(previous);
      setError(errMsg(err, "Couldn't drop membership."));
    } finally {
      setPendingId(null);
      setBillingBusy(false);
    }
  };

  const onModalConfirm = (target: StrategyId) => {
    if (!subscribed) {
      void commitJoin(target);
      return;
    }
    commitSwitch(target);
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
          One membership, four strategies — switch your discount posture free
          anytime.
        </p>
      </header>

      <MembershipBox
        currency={place.currency}
        place={place}
        pillState={pillState}
        billingBusy={billingBusy}
        onDrop={() => void commitDrop()}
      />

      <Section
        title="Strategy"
        description="Four discount postures — switch free anytime while membership is active."
      >
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          {STRATEGIES.map((s) => (
            <PricingCard
              key={s.id}
              strategy={s}
              currency={place.currency}
              // Member-gated (MESITA-948): strategyForPlace maps all-null
              // rates to "zero", so an unsubscribed place would otherwise
              // ring Zero as "Current" and block join-onto-Zero.
              selected={isCardCurrent(subscribed, selectedId, s.id)}
              pending={pendingId === s.id}
              subscribed={subscribed}
              joinDisabled={joinDisabled}
              onOpen={() => !joinDisabled && setModalId(s.id)}
            />
          ))}
        </div>

        {activationStrategy && (
          <p className="rounded-xl bg-emerald-50 p-3 text-[12px] leading-snug text-emerald-800">
            Membership started with{" "}
            <span className="font-semibold">
              {activationStrategy.emoji} {activationStrategy.name}
            </span>
            . It activates the first time your staff honor a guest check at the
            table.
          </p>
        )}

        {selectedId === null && subscribed && (
          <p className="text-muted-foreground text-[11px]">
            Your current rates don&apos;t match a Strategy — pick one to
            standardize them.
          </p>
        )}

        {error && <p className={ERROR_BOX_CLASS}>{error}</p>}
      </Section>

      <FaqsBox
        place={place}
        storedStrategy={storedStrategy}
        member={subscribed}
      />

      {modalStrategy && (
        <ProductModal
          strategy={modalStrategy}
          currency={place.currency}
          isCurrent={isCardCurrent(subscribed, selectedId, modalStrategy.id)}
          subscribed={subscribed}
          joinDisabled={joinDisabled}
          billingBusy={billingBusy || pendingId === modalStrategy.id}
          onCommit={() => onModalConfirm(modalStrategy.id)}
          onClose={() => setModalId(null)}
        />
      )}
    </div>
  );
}
