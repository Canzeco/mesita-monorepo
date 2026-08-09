"use client";

import { Check } from "lucide-react";
import {
  STRATEGY_BY_ID,
  type StrategyId,
} from "@/lib/business/strategies";
import { cn, formatMoney } from "@/lib/utils";
import type { MyPlace } from "@/lib/api/places";
import { PRODUCT_PRICE_MXN } from "./promoConstants";
import type { MembershipPillState } from "./promoShared";
import {
  lifecycleView,
  type LifecycleStepState,
} from "./promo-state";

const ZERO_STRATEGY_ID: StrategyId = "zero";

const STEP_TITLES = {
  join: "Join the membership",
  strategy: "Pick a strategy",
  honor: "Honor guest checks",
} as const;

/** Owner-facing twin of admin LifecycleStepper (MESITA-959 ← MESITA-958). */
export function LifecycleStepper({
  place,
  pillState,
  storedStrategy,
  member,
}: {
  place: MyPlace;
  pillState: MembershipPillState;
  storedStrategy: StrategyId | null;
  member: boolean;
}) {
  const view = lifecycleView(place, storedStrategy);
  const price = formatMoney(PRODUCT_PRICE_MXN, place.currency);
  const strategy =
    member && storedStrategy ? STRATEGY_BY_ID[storedStrategy] : null;

  if (view.kind === "strip") {
    const warn = view.tone === "warn";
    return (
      <section className="border-border bg-card shadow-card rounded-2xl border px-5 py-3.5 sm:px-6">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
          <span
            aria-hidden
            className={cn(
              "h-2 w-2 shrink-0 self-center rounded-full",
              warn ? "bg-amber-500" : "bg-emerald-500",
            )}
          />
          <span className="font-display font-semibold tracking-tight">
            Promos live
          </span>
          <span className={warn ? "text-amber-800" : "text-muted-foreground"}>
            {warn
              ? `${view.strikes} active strike${view.strikes === 1 ? "" : "s"} of 3 — the third forfeits membership.`
              : "All three steps done — joined, strategy set, checks honored."}
          </span>
        </p>
      </section>
    );
  }

  const forfeited = pillState === "forfeited";

  const joinDetail =
    view.join === "current"
      ? `${price}/year — join by picking a strategy below.`
      : `${price}/year — switch strategies free anytime.`;
  const strategyDetail =
    view.strategy === "done" && strategy
      ? `${strategy.emoji} ${strategy.name} — switch free anytime.`
      : view.strategy === "current"
        ? storedStrategy === ZERO_STRATEGY_ID
          ? "Zero pauses discounts — pick a paid strategy to reopen the lane."
          : "Custom rates — pick a strategy to standardize."
        : "Three discount postures — switch free anytime.";
  const honorDetail =
    view.honor === "blocked"
      ? forfeited
        ? "Membership forfeited after 3 strikes — re-join by picking a strategy below."
        : `Discounts paused until ${String(place.promo_paused_until ?? "").slice(0, 10)} (strike 2 of 3).`
      : view.honor === "current"
        ? "Staff scan the guest's QR on Mesita Check — honor the first check at the bill to go live."
        : view.honor === "done"
          ? "Activated — the first guest check was honored."
          : "The first honored check makes you live — turning a guest away is a strike.";

  const steps: {
    key: keyof typeof STEP_TITLES;
    state: LifecycleStepState;
    detail: string;
  }[] = [
    { key: "join", state: view.join, detail: joinDetail },
    { key: "strategy", state: view.strategy, detail: strategyDetail },
    { key: "honor", state: view.honor, detail: honorDetail },
  ];

  return (
    <section className="border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold tracking-tight">
        How promos go live
      </h2>
      <ol className="mt-4 flex flex-col gap-5 sm:grid sm:grid-cols-3 sm:gap-6">
        {steps.map((s, i) => (
          <li
            key={s.key}
            aria-current={s.state === "current" ? "step" : undefined}
            className="relative pl-9 sm:pl-0 sm:pt-9"
          >
            <span className="absolute top-0 left-0">
              <StepMarker n={i + 1} state={s.state} danger={forfeited} />
            </span>
            {i < steps.length - 1 && (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-7 -bottom-4 left-[11px] w-px sm:hidden",
                    steps[i + 1].state === "upcoming"
                      ? "bg-border"
                      : "bg-emerald-500/60",
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-[11px] left-8 hidden h-0.5 w-[calc(100%-2.5rem)] rounded-full sm:block",
                    steps[i + 1].state === "upcoming"
                      ? "bg-border"
                      : "bg-emerald-500/60",
                  )}
                />
              </>
            )}
            <p className="text-foreground/90 text-[13px] leading-snug font-semibold">
              {STEP_TITLES[s.key]}
            </p>
            <p
              className={cn(
                "mt-0.5 text-[11px] leading-snug",
                s.state === "blocked"
                  ? forfeited
                    ? "text-destructive"
                    : "text-amber-800"
                  : s.state === "current"
                    ? "text-amber-800"
                    : "text-muted-foreground",
              )}
            >
              {s.detail}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StepMarker({
  n,
  state,
  danger,
}: {
  n: number;
  state: LifecycleStepState;
  danger: boolean;
}) {
  if (state === "done") {
    return (
      <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3 w-3" aria-hidden />
        <span className="sr-only">Step {n} done</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border text-[11px] font-bold tabular-nums",
        state === "current" &&
          "border-amber-500 bg-amber-500/12 text-amber-800",
        state === "blocked" &&
          (danger
            ? "border-destructive bg-destructive/10 text-destructive"
            : "border-amber-500 bg-amber-500/12 text-amber-800"),
        state === "upcoming" && "border-border bg-card text-muted-foreground",
      )}
    >
      {state === "blocked" ? "!" : n}
    </span>
  );
}
