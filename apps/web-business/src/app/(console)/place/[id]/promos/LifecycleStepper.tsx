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
  join: "Join Partnership",
  strategy: "Pick a strategy",
  honor: "Honor guest checks",
} as const;

/**
 * Owner-facing twin of the admin lifecycle banner (MESITA-959 ← MESITA-958,
 * re-cut in MESITA-1001 ← MESITA-999).
 *
 * One rail of three markers + ONE detail line for the step you're actually on.
 * The earlier three-column stepper printed all three details at once, which
 * read as a wall of 11px above the boxes that carry the actual controls; every
 * rail state has exactly one current-or-blocked step, so a single line says the
 * same thing. Non-interactive on purpose — Drop lives on the Partnership bar;
 * strategy lives on the cards.
 */
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
            Partnership live
          </span>
          <span className={warn ? "text-amber-800" : "text-muted-foreground"}>
            {warn
              ? `${view.strikes} active strike${view.strikes === 1 ? "" : "s"} of 3 — the third forfeits Partnership.`
              : "All three steps done — joined, strategy set, checks honored."}
          </span>
        </p>
      </section>
    );
  }

  const forfeited = pillState === "forfeited";

  const joinDetail =
    view.join === "current"
      ? `${price}/month — Join Partnership on this page.`
      : `${price}/month — switch strategies free anytime.`;
  const strategyDetail =
    view.strategy === "done" && strategy
      ? `${strategy.emoji} ${strategy.name} — switch free anytime.`
      : view.strategy === "current"
        ? storedStrategy === ZERO_STRATEGY_ID
          ? "Zero pauses discounts — pick a paid strategy to reopen the lane."
          : "Custom rates — pick a strategy to standardize."
        : "Zero, Conservative, or Aggressive — switch free anytime.";
  const honorDetail =
    view.honor === "blocked"
      ? forfeited
        ? "Partnership forfeited after 3 strikes — re-join on this page."
        : `Discounts paused until ${String(place.promo_paused_until ?? "").slice(0, 10)} (strike 2 of 3).`
      : view.honor === "current"
        ? "Staff scan the guest's QR on Mesita Validate — honor the first check at the bill to go live."
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

  // Exactly one step is blocked-or-current in every rail state (see
  // lifecycleView) — that one carries the line.
  const active =
    steps.find((s) => s.state === "blocked") ??
    steps.find((s) => s.state === "current");

  return (
    <section className="border-border bg-card shadow-card rounded-2xl border px-4 py-4 sm:px-5">
      {/* The rail replaced a visible "How rewards go live" heading — the steps
          say it. Keep the label for screen readers. */}
      <h2 className="sr-only">How rewards go live</h2>
      <ol className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
        {steps.map((s, i) => (
          <li
            key={s.key}
            aria-current={s.state === "current" ? "step" : undefined}
            // The connector rides inside its step so the row stays a plain
            // <ol>/<li> (no display:contents, which drops list semantics in
            // some screen readers); the last step doesn't stretch.
            className="flex min-w-0 items-center gap-2 sm:flex-1 sm:last:flex-none"
          >
            <StepMarker n={i + 1} state={s.state} danger={forfeited} />
            <span
              className={cn(
                "truncate text-[12.5px] leading-none",
                s.state === "current" || s.state === "blocked"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground font-medium",
              )}
            >
              {STEP_TITLES[s.key]}
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "ml-1 hidden h-px flex-1 sm:block",
                  steps[i + 1].state === "upcoming"
                    ? "bg-border"
                    : "bg-emerald-500/50",
                )}
              />
            )}
          </li>
        ))}
      </ol>
      {active && (
        <p
          className={cn(
            "mt-2.5 text-[12px] leading-snug",
            // `active` is blocked-or-current by construction; only forfeiture
            // earns destructive red.
            active.state === "blocked" && forfeited
              ? "text-destructive"
              : "text-amber-800",
          )}
        >
          {active.detail}
        </p>
      )}
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
      <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-2.5 w-2.5" aria-hidden />
        <span className="sr-only">Step {n} done</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums",
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
