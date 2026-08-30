"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PhoneCall } from "lucide-react";
import { Section } from "@/components/shared";
import { apiUpdatePlace, type MyPlace } from "@/lib/api/places";
import { apiChangeSubscription } from "@/lib/api/subscription";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  DEFAULT_DISCOUNT_CAP_MXN,
  DISCOUNT_CAPS_MXN,
  STRATEGIES,
  STRATEGY_BY_ID,
  snapDiscountCap,
  strategyForPlace,
  type DiscountCapMxn,
  type StrategyId,
} from "@/lib/business/strategies";
import { coercePromosConfig, type PromosConfig } from "@/lib/business/promos";
import { cn, errMsg, formatMoney } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { CheckPinCard } from "./CheckPinCard";
import { FaqsBox } from "./FaqsBox";
import { LifecycleStepper } from "./LifecycleStepper";
import { MembershipBox } from "./MembershipBox";
import { PartnershipOffer } from "./PartnershipOffer";
import { PricingCard } from "./PricingCard";
import { ProductModal } from "./ProductModal";
import { membershipPillState } from "./promoShared";
import { isCardCurrent } from "./promo-state";

function isSubscribed(place: MyPlace): boolean {
  return place.plan !== "free";
}

function buildStrategyPayload(
  place: MyPlace,
  target: StrategyId,
  fromId: StrategyId | null,
) {
  const strat = STRATEGY_BY_ID[target];
  const payload = {
    welcome_free_rate: strat.rates.welcome_free_rate,
    welcome_premium_rate: strat.rates.welcome_premium_rate,
    free_rate: strat.rates.free_rate,
    premium_rate: strat.rates.premium_rate,
  };
  if (target === "zero") {
    return { ...payload, monthly_promo_cap: null };
  }
  if (fromId === "zero" || fromId === null) {
    return {
      ...payload,
      monthly_promo_cap: place.monthly_promo_cap ?? DEFAULT_DISCOUNT_CAP_MXN,
    };
  }
  return payload;
}

// "+16282960710" → "+1 (628) 296-0710"; anything non-NANP passes through.
function formatLine(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function PromosClient({
  place,
  rewardsConfig,
  isOwner,
  checkPin,
  placeLine,
}: {
  place: MyPlace;
  rewardsConfig: unknown;
  isOwner: boolean;
  checkPin: string | null;
  placeLine: string | null;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  const cfg: PromosConfig = coercePromosConfig(rewardsConfig);
  const ratesAreDefaults = rewardsConfig == null;

  const subscribed = isSubscribed(place);
  const pillState = membershipPillState(place);
  const forfeited = pillState === "forfeited";
  const sell = !subscribed || forfeited;

  const storedStrategy = strategyForPlace(place);
  const [selectedId, setSelectedId] = useState<StrategyId | null>(
    storedStrategy,
  );
  const [pendingId, setPendingId] = useState<StrategyId | null>(null);
  const [modalId, setModalId] = useState<StrategyId | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [pendingCap, setPendingCap] = useState<DiscountCapMxn | null>(null);
  const [error, setError] = useState<string | null>(null);

  const promosOrigin =
    typeof window !== "undefined" ? window.location.origin : "";

  const currentCap = snapDiscountCap(place.monthly_promo_cap);
  const showDiscountCap =
    subscribed && selectedId !== null && selectedId !== "zero";
  const displayCapMxn = showDiscountCap ? currentCap : undefined;

  const commitSwitch = (target: StrategyId) => {
    setModalId(null);
    if (pendingId || !subscribed || target === selectedId) return;
    const previous = selectedId;
    setSelectedId(target);
    setPendingId(target);
    setError(null);
    void apiUpdatePlace(supabase, {
      id: place.id,
      ...buildStrategyPayload(place, target, previous),
    })
      .then(() => router.refresh())
      .catch((err) => {
        setSelectedId(previous);
        setError(errMsg(err, "Couldn't save the Strategy."));
      })
      .finally(() => setPendingId(null));
  };

  const commitJoin = async () => {
    if (billingBusy || pendingId || (subscribed && !forfeited)) return;
    setBillingBusy(true);
    setError(null);
    const previous = selectedId;
    try {
      const result = await apiChangeSubscription(supabase, {
        projectId: place.id,
        plan: "pro",
        successUrl: `${promosOrigin}/place/${place.id}/promos?subscription=success`,
        cancelUrl: `${promosOrigin}/place/${place.id}/promos?subscription=cancelled`,
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
      setSelectedId("zero");
      setPendingId("zero");
      await apiUpdatePlace(supabase, {
        id: place.id,
        ...buildStrategyPayload(place, "zero", previous),
      });
      router.refresh();
    } catch (err) {
      setError(errMsg(err, "Couldn't start Partnership."));
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
        successUrl: `${promosOrigin}/place/${place.id}/promos?subscription=success`,
        cancelUrl: `${promosOrigin}/place/${place.id}/promos?subscription=cancelled`,
      });
      if (result.checkout_url && !result.mock) {
        window.location.href = result.checkout_url;
        return;
      }
      setSelectedId("zero");
      setPendingId("zero");
      await apiUpdatePlace(supabase, {
        id: place.id,
        ...buildStrategyPayload(place, "zero", previous),
      });
      router.refresh();
    } catch (err) {
      setSelectedId(previous);
      setError(errMsg(err, "Couldn't drop Partnership."));
    } finally {
      setPendingId(null);
      setBillingBusy(false);
    }
  };

  const commitCapChange = (cap: DiscountCapMxn) => {
    if (pendingCap || cap === currentCap) return;
    setPendingCap(cap);
    setError(null);
    void apiUpdatePlace(supabase, { id: place.id, monthly_promo_cap: cap })
      .then(() => router.refresh())
      .catch((err) => {
        setError(errMsg(err, "Couldn't save the discount cap."));
      })
      .finally(() => setPendingCap(null));
  };

  const modalStrategy = modalId ? STRATEGY_BY_ID[modalId] : null;

  // The capability band — what this place offers through Mesita, moved off
  // Settings (Pato live 2026-08-30) so offerings sit with the offerings.
  // It renders in BOTH modes on purpose: Reservations and the Check PIN
  // belong to any Listed place, so a place that has not joined Partnership
  // still reaches them under the pitch.
  const capabilityBand = (
    <>
      {isOwner ? (
        <CheckPinCard projectId={place.id} initialPin={checkPin} />
      ) : null}

      {placeLine ? (
        <section className="bg-card border-border flex items-start gap-3 rounded-2xl border p-4">
          <span className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <PhoneCall className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-foreground text-sm font-semibold">
              Mesita reservations line
            </h2>
            <p className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
              Mesita&apos;s reservation AI calls your place from{" "}
              <span className="text-foreground font-medium whitespace-nowrap">
                {formatLine(placeLine)}
              </span>
              . It&apos;s also the number to call about any Mesita booking —
              save it so your team recognizes it.
            </p>
          </div>
        </section>
      ) : null}
    </>
  );

  if (sell) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-10">
        <PartnershipOffer
          currency={place.currency}
          forfeited={forfeited}
          billingBusy={billingBusy}
          error={error}
          onJoin={() => void commitJoin()}
        />

        {capabilityBand}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-10">
      <MembershipBox
        currency={place.currency}
        pillState={pillState}
        billingBusy={billingBusy}
        onDrop={() => void commitDrop()}
      />

      <LifecycleStepper
        place={place}
        pillState={pillState}
        storedStrategy={storedStrategy}
        member={subscribed}
      />

      <Section
        title="Promos"
        description="Zero, Conservative, or Aggressive — switch free anytime."
      >
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          {STRATEGIES.filter((s) => s.id !== "dominant").map((s) => (
            <PricingCard
              key={s.id}
              strategy={s}
              cfg={cfg}
              selected={isCardCurrent(subscribed, selectedId, s.id)}
              pending={pendingId === s.id}
              onOpen={() => setModalId(s.id)}
            />
          ))}
        </div>

        {ratesAreDefaults && (
          <p className="text-muted-foreground text-[11px]">
            Live rates unavailable — showing standard rates.
          </p>
        )}

        {selectedId === null && (
          <p className="text-muted-foreground text-[11px]">
            Your current rates don&apos;t match a Strategy — pick one to
            standardize them.
          </p>
        )}
      </Section>

      {showDiscountCap && (
        <Section
          title="Discount cap"
          description="How much of each bill your discounts can touch — independent of strategy."
        >
          <div className="flex flex-wrap gap-2">
            {DISCOUNT_CAPS_MXN.map((cap) => {
              const active = cap === currentCap;
              const busy = pendingCap === cap;
              return (
                <button
                  key={cap}
                  type="button"
                  disabled={!!pendingCap}
                  onClick={() => commitCapChange(cap)}
                  className={cn(
                    "inline-flex h-9 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-full border px-4 text-[12px] font-bold tabular-nums transition",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-foreground/80 hover:bg-muted",
                    pendingCap && !busy && "opacity-60",
                  )}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {formatMoney(cap, place.currency)}
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground text-[11px] leading-snug">
            Every discount applies only to the first{" "}
            {formatMoney(currentCap, place.currency)} of the bill. Guests always
            see this cap on your offer.
          </p>
        </Section>
      )}

      {error && <p className={ERROR_BOX_CLASS}>{error}</p>}

      <FaqsBox
        place={place}
        storedStrategy={storedStrategy}
        member={subscribed}
        cfg={cfg}
      />

      {capabilityBand}

      {modalStrategy && (
        <ProductModal
          strategy={modalStrategy}
          cfg={cfg}
          currency={place.currency}
          capMxn={modalStrategy.id !== "zero" ? displayCapMxn : undefined}
          isCurrent={isCardCurrent(subscribed, selectedId, modalStrategy.id)}
          billingBusy={billingBusy || pendingId === modalStrategy.id}
          onCommit={() => commitSwitch(modalStrategy.id)}
          onClose={() => setModalId(null)}
        />
      )}
    </div>
  );
}
