"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import {
  BookOpen,
  Check,
  Loader2,
  Percent,
  TrendingUp,
  X,
} from "lucide-react";
import {
  DEFAULT_DISCOUNT_CAP_MXN,
  STRATEGIES,
  STRATEGY_BY_ID,
  strategyForPlace,
  type Strategy,
  type StrategyId,
} from "@/lib/business/strategies";
import { planForSubscription } from "@/lib/business/plans";
import {
  setPlacePlan,
  setPlaceRails,
  setPlaceStrategy,
  type AdminPlace,
  type PlaceRails,
} from "../actions";
import { PROMOTION_SCORE_MAX, promotionScore } from "@/lib/business/promotion-score";
import { OPERATOR_PROMOTING_LABEL } from "@/lib/status-vocabulary";
import { placeOperatorPromotingLevel } from "./StatusCard";
import { ConfirmDialog, SectionCard } from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";
import {
  describeMembershipStatus,
  giveWord,
  isMemberPlan,
  lifecycleView,
  membershipPillState,
  placementWord,
  promoCardState,
  RUNG_WORDS,
  type CardState,
  type LifecycleStepState,
  type MembershipPillState,
  type RungWord,
} from "./promo-state";

// Admin Partner tab — four boxes (Pato gate 2026-08-29):
//   1. Tutorial — join, pick Visit Rewards, honor guest checks. Strikes.
//   2. Promos — the promotion PROGRESS BAR ("Promos" names the bar): the
//      0–7 score summing what the place offers, its components as rows.
//      Partnership is the first step; the four rail rows are LIVE TOGGLES
//      (admin-web-set-place-rails); Mesita Capital is a locked Soon row.
//      Display-only — never a discovery input; rank is never for sale.
//   3. Partnership — MX$1,000/month is the subscription. Stripe-look mock
//      Join writes plan=pro at Zero (admin-web-set-plan, no charge).
//      Strategy unlocks after. Lifecycle rail, status pill, drop.
//   4. Visit Rewards — Zero · Conservative · Aggressive tiles. Give and
//      placement are a Low · Mid · High word ladder. Dominant is not a
//      picker option. (Never called "Promos" — that names the bar.)

const MEMBERSHIP_PRICE_MXN = 1000;

// The free, no-discount strategy — the "leaving"/"not paid" boundary checked
// throughout this file.
const ZERO_STRATEGY_ID: StrategyId = "zero";

/** Zero · Conservative · Aggressive. Dominant is not a picker option. */
function pickerStrategies(): readonly Strategy[] {
  return STRATEGIES.filter((s) => s.id !== "dominant");
}

// Per-strategy visual identity. Art = generated 1:1 abstract waves (no text
// in pixels — copy stays HTML); the gradient paints behind the image so a
// slow or missing asset still renders a branded band. `accent` colours the
// Give / Placement words.
const CARD_ART: Record<
  StrategyId,
  { src: string; fallback: string; cta: string; accent: string }
> = {
  zero: {
    src: "/promos/strategy-zero.jpg",
    fallback: "from-slate-800 to-slate-500",
    cta: "",
    accent: "text-slate-500",
  },
  conservative: {
    src: "/promos/strategy-conservative.jpg",
    fallback: "from-emerald-900 to-teal-500",
    cta: "from-emerald-600 to-teal-500",
    accent: "text-emerald-600",
  },
  aggressive: {
    src: "/promos/strategy-aggressive.jpg",
    fallback: "from-red-800 to-orange-500",
    cta: "from-red-600 to-orange-500",
    accent: "text-orange-600",
  },
  // No art file yet — the gradient IS the fallback, which is why it exists.
  // Violet reads as the rung above orange without colliding with any other
  // strategy on the rail.
  dominant: {
    src: "/promos/strategy-dominant.jpg",
    fallback: "from-violet-900 to-fuchsia-500",
    cta: "from-violet-600 to-fuchsia-500",
    accent: "text-violet-600",
  },
};

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

function formatMoney(amount: number, currency: string | null): string {
  const prefix = !currency || currency === "MXN" ? "MX$" : "$";
  return `${prefix}${amount.toLocaleString("en-US")}`;
}

// Membership/pill/card/meter derivations live in ./promo-state (pure module,
// place-tested — see promo-state.test.ts).

function strategyRatesOnly(s: Strategy) {
  return {
    welcome_free_rate: s.rates.welcome_free_rate,
    welcome_premium_rate: s.rates.welcome_premium_rate,
    free_rate: s.rates.free_rate,
    premium_rate: s.rates.premium_rate,
  };
}

/** Strategy writes the four rate columns; Zero clears cap; leaving Zero seeds default cap when null. */
function strategySwitchPatch(
  target: StrategyId,
  place: AdminPlace,
  storedStrategy: StrategyId | null,
): Record<string, number | null> {
  const rates = strategyRatesOnly(STRATEGY_BY_ID[target]);
  if (target === ZERO_STRATEGY_ID) {
    return { ...rates, monthly_promo_cap: null };
  }
  const fromZero =
    storedStrategy === ZERO_STRATEGY_ID || strategyForPlace(place) === ZERO_STRATEGY_ID;
  if (fromZero && place.monthly_promo_cap == null) {
    return { ...rates, monthly_promo_cap: DEFAULT_DISCOUNT_CAP_MXN };
  }
  return rates;
}

export function PromosSection({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const [v, setV] = useState(place);
  // Write-through / optimistic — no draft dirtyMap (E-R0). Strategy SWITCH
  // stays optimistic (rates-only; the moving ring is the feedback).
  // Membership writes — join, drop — are PESSIMISTIC: they apply on EF
  // success only. Switch is optimistic. Join errors land on Partnership;
  // switch errors under the strategy grid; drop errors in the confirm.

  const [switchPending, startSwitch] = useTransition();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [modalId, setModalId] = useState<StrategyId | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropBusy, setDropBusy] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [railBusy, setRailBusy] = useState<keyof PlaceRails | null>(null);
  const [railError, setRailError] = useState<string | null>(null);

  const member = isMemberPlan(v.plan);
  const pillState = membershipPillState(v);
  const storedStrategy = strategyForPlace(v);
  const forfeited = pillState === "forfeited";

  const applyPlace = (next: AdminPlace) => {
    setV(next);
    onSaved(next);
  };

  const revertPlace = (prev: AdminPlace) => {
    setV(prev);
    onSaved(prev);
  };

  // Partnership join is its own door (setPlacePlan at Zero). The EF clears
  // the forfeit stamp + strikes on re-grant. Strategy is a later switch.
  const commitJoinPartnership = async () => {
    if (joinBusy || (member && !forfeited)) return;
    const rates = strategySwitchPatch(ZERO_STRATEGY_ID, v, storedStrategy);
    const plan = planForSubscription("pro_discount");

    setJoinBusy(true);
    setJoinError(null);
    const r = await setPlacePlan(v.id, plan, rates);
    setJoinBusy(false);
    if (!r.ok) {
      setJoinError(r.error);
      return;
    }
    applyPlace(r.data);
  };

  const commitDrop = async () => {
    if (dropBusy || !member) return;
    const rates = strategySwitchPatch(ZERO_STRATEGY_ID, v, storedStrategy);
    const plan = planForSubscription("free");

    setDropBusy(true);
    setDropError(null);
    const r = await setPlacePlan(v.id, plan, rates);
    setDropBusy(false);
    if (!r.ok) {
      setDropError(r.error);
      return;
    }
    applyPlace(r.data);
    setDropOpen(false);
  };

  const commitSwitch = (target: StrategyId) => {
    setModalId(null);
    if (switchPending || !member || target === storedStrategy) return;
    const rates = strategySwitchPatch(target, v, storedStrategy);

    const prev = v;
    const optimistic: AdminPlace = { ...v, ...rates };
    applyPlace(optimistic);
    setSwitchError(null);

    startSwitch(async () => {
      const r = await setPlaceStrategy(prev.id, rates);
      if (!r.ok) {
        revertPlace(prev);
        setSwitchError(r.error);
        return;
      }
      applyPlace(r.data);
    });
  };

  // Rail toggles — optimistic per-toggle with revert, mirroring the strategy
  // switch. One rail writes at a time; the response's post-write truth is
  // merged so a concurrent flip elsewhere cannot leave a stale bit.
  const RAIL_COLUMN = {
    mesita_pay: "mesita_pay_enabled",
    yums: "yums_enabled",
    pickup: "pickup_orders_enabled",
    delivery: "delivery_orders_enabled",
  } as const;

  const commitRail = async (key: keyof PlaceRails, next: boolean) => {
    if (railBusy) return;
    const prev = v;
    const optimistic: AdminPlace = { ...v, [RAIL_COLUMN[key]]: next };
    applyPlace(optimistic);
    setRailBusy(key);
    setRailError(null);
    const r = await setPlaceRails(prev.id, { [key]: next });
    setRailBusy(null);
    if (!r.ok) {
      revertPlace(prev);
      setRailError(r.error);
      return;
    }
    applyPlace({
      ...optimistic,
      mesita_pay_enabled: r.data.mesita_pay,
      yums_enabled: r.data.yums,
      pickup_orders_enabled: r.data.pickup,
      delivery_orders_enabled: r.data.delivery,
    });
  };

  const onCardOpen = (id: StrategyId) => {
    setModalId(id);
  };

  const onModalConfirm = (target: StrategyId) => {
    if (!member || forfeited) return;
    commitSwitch(target);
  };

  const onModalClose = () => {
    setModalId(null);
  };

  const modalStrategy = modalId ? STRATEGY_BY_ID[modalId] : null;

  return (
    <div className="flex flex-col gap-4">
      <TutorialBox currency={v.currency} />

      <PromosBar
        place={v}
        member={member}
        railBusy={railBusy}
        railError={railError}
        onToggle={(key, next) => void commitRail(key, next)}
      />

      <MembershipBox
        place={v}
        pillState={pillState}
        storedStrategy={storedStrategy}
        member={member}
        joinBusy={joinBusy}
        joinError={joinError}
        onJoinClick={() => void commitJoinPartnership()}
        onDropClick={() => {
          setDropError(null);
          setDropOpen(true);
        }}
      />

      <SectionCard
        icon={<Percent className="h-4 w-4" />}
        tint="amber"
        title="Visit Rewards"
        subtitle="Zero · Conservative · Aggressive — orders and prepaid stay off."
        action={
          switchPending ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          ) : undefined
        }
      >
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pickerStrategies().map((s) => (
            <StrategyCard
              key={s.id}
              strategy={s}
              state={promoCardState({
                member,
                forfeited,
                storedStrategy,
                cardId: s.id,
                paid: s.id !== ZERO_STRATEGY_ID,
              })}
              pending={switchPending && s.id === storedStrategy}
              onOpen={() => onCardOpen(s.id)}
            />
          ))}
        </div>

        {(storedStrategy === null || storedStrategy === "dominant") && member && (
          <p className="text-muted-foreground mt-2.5 type-label">
            Current rates don&apos;t match a strategy — pick one to standardize.
          </p>
        )}

        {/* Always-mounted live region: a region that mounts together with its
            message does not announce. Switch errors land here, beside the
            gesture; join/drop errors live in their modal/dialog. */}
        <div aria-live="polite">
          {switchError && (
            <div className="mt-3">
              <ErrorNote message={switchError} />
            </div>
          )}
        </div>
      </SectionCard>

      {modalStrategy && (
        <ProductModal
          strategy={modalStrategy}
          currency={v.currency}
          state={promoCardState({
            member,
            forfeited,
            storedStrategy,
            cardId: modalStrategy.id,
            paid: modalStrategy.id !== ZERO_STRATEGY_ID,
          })}
          member={member}
          busy={switchPending}
          error={null}
          onConfirm={() => onModalConfirm(modalStrategy.id)}
          onClose={onModalClose}
        />
      )}

      <ConfirmDialog
        open={dropOpen}
        danger
        busy={dropBusy}
        error={dropError}
        title="Drop partnership?"
        body="Ends the partnership and clears activation — re-joining restarts pending activation. Strikes and any active pause carry over if the place re-joins."
        confirmLabel="Drop partnership"
        onConfirm={() => void commitDrop()}
        onCancel={() => {
          if (!dropBusy) {
            setDropOpen(false);
            setDropError(null);
          }
        }}
      />
    </div>
  );
}

// ─── Lifecycle banner — this place's progress on the three Tutorial steps ─
//
// One rail of three markers + ONE detail line for the step you're on. The
// earlier three-column stepper printed all three details at once, which read
// as a wall of 11px next to the boxes that carry the actual controls; every
// rail state has exactly one current-or-blocked step, so a single line says
// the same thing. Live on a paid strategy collapses to a slim strip (the
// teaching job is done; strikes keep it honest). Non-interactive on purpose:
// the actionable controls stay in the Membership box and strategy cards.
// decision: the banner does NOT repeat the MembershipStatusPill — the
// Membership box header keeps the only pill in the viewport.

const STEP_TITLES = {
  join: "Join the partnership",
  strategy: "Pick a strategy",
  honor: "Honor guest checks",
} as const;

function LifecycleBanner({
  place,
  pillState,
  storedStrategy,
  member,
}: {
  place: AdminPlace;
  pillState: MembershipPillState;
  storedStrategy: StrategyId | null;
  member: boolean;
}) {
  const view = lifecycleView(place, storedStrategy);
  const price = formatMoney(MEMBERSHIP_PRICE_MXN, place.currency);
  const strategy =
    member && storedStrategy ? STRATEGY_BY_ID[storedStrategy] : null;

  if (view.kind === "strip") {
    const warn = view.tone === "warn";
    return (
      <section className="border-border/60 rounded-xl border px-4 py-3">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 type-body">
          <span
            aria-hidden
            className={cx(
              "h-2 w-2 shrink-0 self-center rounded-full",
              warn ? "bg-amber-500" : "bg-emerald-500",
            )}
          />
          <span className="font-display font-semibold tracking-tight">
            Partner live
          </span>
          <span className={warn ? "text-amber-800" : "text-muted-foreground"}>
            {warn
              ? `${view.strikes} active strike${view.strikes === 1 ? "" : "s"} of 3 — the third forfeits the partnership.`
              : "All three steps done — joined, strategy set, checks honored."}
          </span>
        </p>
      </section>
    );
  }

  const forfeited = pillState === "forfeited";

  // Helper copy per step, keyed off the derived state + pill. Only the active
  // step's line renders.
  const joinDetail =
    view.join === "current"
      ? `${price}/month — Join Partnership with the Stripe mock below.`
      : `${price}/month — switch strategies free anytime.`;
  const strategyDetail =
    view.strategy === "done" && strategy
      ? `${strategy.emoji} ${strategy.name} — switch free anytime.`
      : view.strategy === "current"
        ? storedStrategy === ZERO_STRATEGY_ID
          ? "Zero pauses discounts — pick a paid strategy to reopen the lane."
          : "Custom rates — pick a strategy to standardize."
          : "Conservative or Aggressive — switch free anytime.";
  const honorDetail =
    view.honor === "blocked"
      ? forfeited
        ? "Partnership forfeited after 3 strikes — Re-join Partnership below."
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
    <section className="border-border/60 rounded-xl border px-4 py-3">
      {/* The rail replaced a visible "How promos go live" heading — the steps
          say it. Keep the label for screen readers. */}
      <h2 className="sr-only">How promos go live</h2>
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
              className={cx(
                "truncate type-body leading-none",
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
                className={cx(
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
          className={cx(
            "mt-2.5 text-xs leading-snug",
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

// One banner marker: done ✓ (emerald) · current (amber ring) · blocked
// (amber, or red when forfeited) · upcoming (muted outline).
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
      className={cx(
        "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border type-meta font-bold tabular-nums",
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

// ─── Box 1 · Tutorial — the three-step story, always on the page ───────────

const STRIKES: { n: string; consequence: string }[] = [
  { n: "1", consequence: "A warning — your discounts keep running." },
  { n: "2", consequence: "Your discounts are paused for 30 days." },
  {
    n: "3",
    consequence:
      "Partnership forfeited — promos off, place stays listed on Mesita.",
  },
];

function TutorialBox({ currency }: { currency: string | null }) {
  const price = formatMoney(MEMBERSHIP_PRICE_MXN, currency);
  return (
    <SectionCard
      icon={<BookOpen className="h-4 w-4" />}
      tint="sky"
      title="Tutorial"
      subtitle="Join, pick Visit Rewards, honor guest checks."
    >
      <div className="mt-4 flex flex-col gap-4">
        <Step n={1} title="Join the partnership">
          {price}/month — one membership, then pick Visit Rewards freely. Every
          offer you add moves the Promos bar.
        </Step>
        <Step n={2} title="Pick Visit Rewards">
          Zero · Conservative · Aggressive. Give and placement are Low · Mid ·
          High. Rank is never for sale.
        </Step>
        <Step n={3} title="Honor guest checks">
          Staff scan the guest&apos;s QR on Mesita Validate — honoring the first
          check at the bill makes you live.
        </Step>
        <div className="border-border flex flex-col gap-2.5 border-t pt-3">
          <p className="text-muted-foreground type-meta font-bold tracking-[0.14em] uppercase">
            If a guest is turned away
          </p>
          <ol className="flex flex-col gap-1">
            {STRIKES.map((s) => (
              <li key={s.n} className="flex items-start gap-2">
                <span
                  className={cx(
                    "mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full type-meta font-bold",
                    s.n === "3"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-500/15 text-amber-700",
                  )}
                >
                  {s.n}
                </span>
                <span className="text-foreground/80 type-label leading-snug">
                  {s.consequence}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground text-xs leading-snug">
            Join is a mock Stripe checkout — it writes plan, no charge. Strikes
            decay after 6 months clean.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Box 2 · Promos — the promotion progress bar ───────────────────────────
//
// "Promos" names the BAR (Pato, 2026-08-29 — never the strategy tiles). The
// score is the shared 0–7 derivation (promotion-score.ts twins): Partnership
// +1 · Visit Rewards +0/1/2 · each accepted rail +1. Components render as
// rows; the four rail rows are live toggles writing the acceptance intent
// bits through admin-web-set-place-rails. Engines still gate each rail — a
// toggle records what the place OFFERS, and honest row copy says so.
// Display-only: the score never feeds discovery. Rank is never for sale.

const RAIL_ROWS: readonly {
  key: keyof PlaceRails;
  label: string;
  detail: string;
}[] = [
  {
    key: "mesita_pay",
    label: "Accept Mesita Pay",
    detail: "Guests pay the bill by card inside Mesita. The rail ships later — the toggle records the offer.",
  },
  {
    key: "yums",
    label: "Accept Mesita Yums",
    detail: "Yums settle as a bill discount. The Credits engine ships later.",
  },
  {
    key: "pickup",
    label: "Pickup Orders",
    detail: "Pickup through Mesita when the order rail ships.",
  },
  {
    key: "delivery",
    label: "Delivery Orders",
    detail: "Delivery through Mesita when the order rail ships.",
  },
];

function PromosBar({
  place,
  member,
  railBusy,
  railError,
  onToggle,
}: {
  place: AdminPlace;
  member: boolean;
  railBusy: keyof PlaceRails | null;
  railError: string | null;
  onToggle: (key: keyof PlaceRails, next: boolean) => void;
}) {
  const level = placeOperatorPromotingLevel(place);
  const rails: Record<keyof PlaceRails, boolean> = {
    mesita_pay: place.mesita_pay_enabled === true,
    yums: place.yums_enabled === true,
    pickup: place.pickup_orders_enabled === true,
    delivery: place.delivery_orders_enabled === true,
  };
  const score = promotionScore({
    partner: member,
    visitRewardsLevel: level,
    mesitaPay: rails.mesita_pay,
    yums: rails.yums,
    pickup: rails.pickup,
    delivery: rails.delivery,
  });

  return (
    <SectionCard
      icon={<TrendingUp className="h-4 w-4" />}
      tint="violet"
      title="Promos"
      subtitle="The more you offer, the better the promotion."
      action={
        <span className="type-label text-foreground font-semibold tabular-nums">
          {score} / {PROMOTION_SCORE_MAX}
        </span>
      }
    >
      <div
        className="mt-4 flex gap-1"
        role="img"
        aria-label={`Promotion ${score} of ${PROMOTION_SCORE_MAX}`}
      >
        {Array.from({ length: PROMOTION_SCORE_MAX }, (_, i) => (
          <span
            key={i}
            className={cx(
              "h-2 flex-1 rounded-full transition-colors",
              i < score ? "bg-violet-500" : "bg-muted",
            )}
          />
        ))}
      </div>

      <div className="divide-border/60 mt-2 flex flex-col divide-y">
        <BarRow
          label="Partnership Membership"
          detail="The first step — join in the Partnership box below."
          points={member ? "+1" : "0"}
          earned={member}
          control={
            <span
              className={cx(
                "inline-flex items-center rounded-full px-2 py-0.5 type-label font-semibold",
                member
                  ? "bg-green-500/10 text-green-700"
                  : "text-muted-foreground bg-muted",
              )}
            >
              {member ? "Partner" : "Not yet"}
            </span>
          }
        />
        <BarRow
          label="Visit Rewards"
          detail="Zero · Conservative · Aggressive — pick a level below."
          points={`+${level}`}
          earned={level > 0}
          control={
            <span
              className={cx(
                "inline-flex items-center rounded-full px-2 py-0.5 type-label font-semibold",
                level > 0
                  ? "bg-green-500/10 text-green-700"
                  : "text-muted-foreground bg-muted",
              )}
            >
              {OPERATOR_PROMOTING_LABEL[level]}
            </span>
          }
        />
        {RAIL_ROWS.map((row) => (
          <BarRow
            key={row.key}
            label={row.label}
            detail={row.detail}
            points={rails[row.key] ? "+1" : "0"}
            earned={rails[row.key]}
            control={
              <RailToggle
                on={rails[row.key]}
                busy={railBusy === row.key}
                disabled={railBusy !== null && railBusy !== row.key}
                label={row.label}
                onChange={(next) => onToggle(row.key, next)}
              />
            }
          />
        ))}
        <BarRow
          label="Mesita Capital"
          detail="Working-capital advances — a future stage raises the bar."
          points="—"
          earned={false}
          control={
            <span className="text-muted-foreground bg-muted inline-flex items-center rounded-full px-2 py-0.5 type-label font-semibold">
              Soon
            </span>
          }
        />
      </div>

      <div aria-live="polite">
        {railError && (
          <div className="mt-3">
            <ErrorNote message={railError} />
          </div>
        )}
      </div>

      <p className="text-muted-foreground mt-3 text-xs leading-snug">
        A display score for oversight — it never buys rank. Each rail goes
        live with its engine; the toggles record what the place offers.
      </p>
    </SectionCard>
  );
}

function BarRow({
  label,
  detail,
  points,
  earned,
  control,
}: {
  label: string;
  detail: string;
  points: string;
  earned: boolean;
  control?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{detail}</p>
      </div>
      <span
        className={cx(
          "type-label w-6 shrink-0 text-right font-semibold tabular-nums",
          earned ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {points}
      </span>
      {control}
    </div>
  );
}

function RailToggle({
  on,
  busy,
  disabled,
  label,
  onChange,
}: {
  on: boolean;
  busy: boolean;
  disabled: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy || disabled}
      onClick={() => onChange(!on)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        on ? "bg-secondary" : "bg-muted-foreground/25",
        (busy || disabled) && "cursor-default opacity-60",
      )}
    >
      <span
        className={cx(
          "bg-background inline-flex h-5 w-5 transform items-center justify-center rounded-full shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      >
        {busy && (
          <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
        )}
      </span>
    </button>
  );
}

// ─── Box 3 · Partnership ───────────────────────────────────────────────────

function MembershipBox({
  place,
  pillState,
  storedStrategy,
  member,
  joinBusy,
  joinError,
  onJoinClick,
  onDropClick,
}: {
  place: AdminPlace;
  pillState: MembershipPillState;
  storedStrategy: StrategyId | null;
  member: boolean;
  joinBusy: boolean;
  joinError: string | null;
  onJoinClick: () => void;
  onDropClick: () => void;
}) {
  const statusNote =
    pillState === "pending" ? null : describeMembershipStatus(place, pillState);
  const price = formatMoney(MEMBERSHIP_PRICE_MXN, place.currency);
  const notMember = pillState === "not_member";
  const forfeited = pillState === "forfeited";
  const canDrop = !notMember && !forfeited;
  const showJoin = notMember || forfeited;

  const nextLine = notMember
    ? "The subscription is Partnership. After you join, pick a strategy below — switch free anytime."
    : forfeited
      ? "Re-join Partnership to clear the forfeit and strikes; then pick a strategy again."
      : "Switching to Zero pauses discounts without ending the partnership. Dropping is separate.";

  return (
    <SectionCard
      icon={<Percent className="h-4 w-4" />}
      tint="pink"
      title="Partnership"
      action={<MembershipStatusPill state={pillState} />}
    >
      <div className="mt-4 flex flex-col gap-3">
        <LifecycleBanner
          place={place}
          pillState={pillState}
          storedStrategy={storedStrategy}
          member={member}
        />
        {statusNote && (
          <p
            className={cx(
              "rounded-xl px-3 py-2 text-xs leading-snug",
              statusNote.tone === "live" &&
                "bg-emerald-500/10 text-emerald-800",
              statusNote.tone === "warn" && "bg-amber-500/10 text-amber-900",
              statusNote.tone === "blocked" &&
                "bg-destructive/10 text-destructive",
            )}
          >
            {statusNote.label}
          </p>
        )}

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-display text-2xl leading-none font-semibold tracking-tight">
            {price}
            <span className="text-muted-foreground text-xs font-normal">
              {" "}
              / month
            </span>
          </p>
          <p className="text-muted-foreground type-body leading-snug">
            Unlocks{" "}
            <span className="text-foreground font-semibold">Conservative</span>{" "}
            and{" "}
            <span className="text-foreground font-semibold">Aggressive</span>{" "}
            after you join. Zero stays free.
          </p>
        </div>

        <p className="text-muted-foreground text-xs leading-snug">
          {nextLine}
        </p>

        {showJoin && (
          <div className="flex flex-col gap-2">
            <StripeJoinButton
              price={price}
              busy={joinBusy}
              forfeited={forfeited}
              onClick={onJoinClick}
            />
            <p className="text-muted-foreground type-meta leading-snug">
              Mock checkout — writes partner status, no Stripe charge.
            </p>
            <div aria-live="polite">
              {joinError && <ErrorNote message={joinError} />}
            </div>
          </div>
        )}

        {canDrop && (
          <button
            type="button"
            onClick={onDropClick}
            className="text-muted-foreground hover:text-destructive self-start text-xs font-semibold underline underline-offset-4 transition"
          >
            Drop partnership
          </button>
        )}
      </div>
    </SectionCard>
  );
}

/** Stripe Checkout-shaped mock. Writes plan via admin-web-set-plan. */
function StripeJoinButton({
  price,
  busy,
  forfeited,
  onClick,
}: {
  price: string;
  busy: boolean;
  forfeited: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-12 w-full max-w-md items-center justify-center gap-2.5 rounded-md bg-[#635BFF] px-5 type-body font-semibold text-white shadow-sm transition hover:bg-[#5851EA] active:scale-[0.99] disabled:opacity-70"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <StripeMark className="h-5 w-5 shrink-0" />
      )}
      {forfeited
        ? `Re-join Partnership · ${price}/month`
        : `Join Partnership · ${price}/month`}
    </button>
  );
}

function StripeMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.115 1.787-1.115 1.634 0 3.415.66 4.64 1.25v-3.2C15.82 2.89 14.196 2.4 12.407 2.4c-3.96 0-6.582 2.075-6.582 5.546 0 2.705 1.94 4.14 5.162 5.29 2.28.811 3.056 1.426 3.056 2.348 0 .96-.84 1.258-2.12 1.258-1.732 0-3.9-.757-5.492-1.76V18.4c1.632.88 3.53 1.34 5.49 1.34 4.082 0 6.75-2.02 6.75-5.604 0-2.873-1.875-4.406-5.695-5.986z" />
    </svg>
  );
}

// ─── Box 3 · Strategy card — Give and Placement as Low · Mid · High ────────
//
// The face answers two questions — how much do I give, what do I get — in
// words. Every rate behind them is one tap away in the modal.

function StrategyCard({
  strategy,
  state,
  pending,
  onOpen,
}: {
  strategy: Strategy;
  state: CardState;
  pending: boolean;
  onOpen: () => void;
}) {
  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== ZERO_STRATEGY_ID;
  const { selected, cta } = state;
  const give = giveWord(strategy.id);
  const placement = placementWord(strategy.visibility);
  const ariaState = selected
    ? " (current)"
    : cta === "locked"
      ? " (join partnership first)"
      : "";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${strategy.name} — details${ariaState}`}
      className={cx(
        "bg-card group relative flex flex-col overflow-hidden rounded-2xl border text-left transition",
        selected
          ? "border-foreground/70 ring-foreground/70 ring-2"
          : "border-border/60 motion-safe:hover:-translate-y-0.5 hover:shadow-card",
      )}
    >
      <ArtBand strategy={strategy} art={art} height="h-24">
        {selected && (
          <span className="text-foreground absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 type-meta font-bold tracking-wide uppercase shadow-card">
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Current
          </span>
        )}
      </ArtBand>

      <div className="flex w-full flex-1 flex-col gap-3.5 p-4">
        <RungStat
          label="Give"
          value={give}
          valueClass={paid ? art.accent : "text-muted-foreground"}
        />
        <RungStat
          label="Placement"
          value={placement}
          valueClass={paid ? art.accent : "text-muted-foreground"}
        />

        {/* Presentational CTA — the whole card is the button; the modal
            carries the real action. Join lives on Partnership, not here. */}
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          {cta === "current" ? (
            <span className="border-border text-muted-foreground inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border text-xs font-bold">
              <Check className="h-3.5 w-3.5" />
              Current
            </span>
          ) : (
            <span
              className={cx(
                "inline-flex h-11 w-full items-center justify-center rounded-full text-xs font-bold",
                cta === "locked"
                  ? "border-border text-muted-foreground border"
                  : paid
                    ? cx("bg-gradient-to-r text-white", art.cta)
                    : "border-border text-foreground/75 border",
              )}
            >
              {cta === "locked"
                ? "Join partnership first"
                : paid
                  ? "Switch"
                  : "Switch to Zero"}
            </span>
          )}
          <span className="text-muted-foreground group-hover:text-foreground text-center type-label font-medium transition">
            Details
          </span>
        </div>
      </div>
    </button>
  );
}

/** The strategy's art header — shared by the card and its modal. */
function ArtBand({
  strategy,
  art,
  height,
  sizes = "(min-width:640px) 50vw, 100vw",
  titleId,
  children,
}: {
  strategy: Strategy;
  art: (typeof CARD_ART)[StrategyId];
  height: string;
  sizes?: string;
  titleId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "relative w-full shrink-0 bg-gradient-to-br",
        height,
        art.fallback,
      )}
    >
      {/* Gradient behind the image is the loading/404 fallback; the scrim
          keeps the white name legible. */}
      <Image src={art.src} alt="" fill sizes={sizes} className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
      {children}
      <p
        id={titleId}
        className="font-display absolute inset-x-4 bottom-2.5 truncate text-sm font-bold tracking-wide text-white uppercase drop-shadow-card"
      >
        <span className="mr-1" aria-hidden>
          {strategy.emoji}
        </span>
        {strategy.name}
      </p>
    </div>
  );
}

/** Give / Placement as a Low · Mid · High word ladder. No meters, no percents. */
function RungStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: RungWord;
  valueClass: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground type-meta font-bold tracking-[0.14em] uppercase">
        {label}
      </span>
      <p
        className="flex items-baseline gap-2.5"
        aria-label={`${label} ${value}`}
      >
        {RUNG_WORDS.map((rung) => (
          <span
            key={rung}
            className={cx(
              "font-display text-base leading-none font-bold tracking-tight",
              rung === value ? valueClass : "text-muted-foreground/35",
            )}
          >
            {rung}
          </span>
        ))}
      </p>
    </div>
  );
}

// ─── Product modal — full detail + the action ───────────────────────────────

function ProductModal({
  strategy,
  currency,
  state,
  member,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  strategy: Strategy;
  currency: string | null;
  state: CardState;
  member: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // Native <dialog> (WCAG 2.4.3): showModal() renders the page behind inert
  // and handles Escape natively — Escape fires `cancel`, blocked while a
  // pessimistic write is in flight. React unmounts this component on close,
  // which skips the `close` event, so focus-restore to the opening card runs
  // in the effect cleanup instead.
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    return () => opener?.focus();
  }, []);

  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== ZERO_STRATEGY_ID;
  const kind = state.cta;
  const isCurrent = kind === "current";
  const price = formatMoney(MEMBERSHIP_PRICE_MXN, currency);
  const give = giveWord(strategy.id);
  const placement = placementWord(strategy.visibility);

  const primaryLabel =
    kind === "current"
      ? "Current strategy"
      : kind === "locked"
        ? "Join partnership first"
        : kind === "switch"
          ? `Switch to ${strategy.name}`
          : "Switch to Zero";

  const footerNote =
    kind === "current"
      ? ""
      : kind === "locked"
        ? `The subscription is Partnership at ${price}/month. Join there, then switch strategies free.`
        : kind === "switch_zero"
          ? "Partnership stays active; discounts pause. Promo lane closes until you pick a paid strategy again."
          : "Applies to new tickets only — open tickets keep the rates they were created with.";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="product-modal-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={onClose}
      onClick={(e) => {
        // p-0 + inner content wrapper: a click whose target is the <dialog>
        // itself can only be the ::backdrop.
        if (!busy && e.target === e.currentTarget) onClose();
      }}
      className="border-border bg-card m-auto hidden max-h-[88vh] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border p-0 shadow-elev backdrop:bg-black/45 backdrop:backdrop-blur-sm open:flex max-sm:mt-auto max-sm:mb-4"
    >
      <ArtBand
        strategy={strategy}
        art={art}
        height="h-28"
        sizes="28rem"
        titleId="product-modal-title"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="absolute top-2.5 right-2.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
        {isCurrent && (
          <span className="text-foreground absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 type-meta font-bold tracking-wide uppercase shadow-card">
            <Check className="h-3 w-3" />
            Current
          </span>
        )}
      </ArtBand>

      {/* Detail — everything the card abstracts away. */}
      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        <p className="text-muted-foreground type-body leading-snug">
          {strategy.tagline}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <RungStat
            label="Give"
            value={give}
            valueClass={paid ? art.accent : "text-muted-foreground"}
          />
          <RungStat
            label="Placement"
            value={placement}
            valueClass={paid ? art.accent : "text-muted-foreground"}
          />
        </div>

        {paid ? (
          <div className="flex flex-col gap-3">
              {/* Canonical step titles — mirror Tutorial and the Partnership
                  lifecycle rail. Never fork the wording. */}
              <ModalLabel>How it works</ModalLabel>
              <Step n={1} title="Join the partnership">
                {price}/month — one membership, then switch strategies free.
              </Step>
              <Step n={2} title="Pick a strategy">
                Confirming makes {strategy.name} your posture — switch free
                anytime.
              </Step>
              <Step n={3} title="Honor guest checks">
                Staff scan the guest&apos;s QR on Mesita Validate — honoring the
                first check at the bill makes you live.
              </Step>
              <p className="text-muted-foreground type-meta leading-snug">Refusing a guest is a strike: 1 warning · 2 paused 30 days · 3 removed.</p>
            </div>
        ) : (
          <div className="flex flex-col gap-2">
            <ModalLabel>How it works</ModalLabel>
            <p className="text-muted-foreground text-xs leading-snug">
              {member
                ? "Zero pauses discounts — partnership stays active. Drop the partnership separately if you want to leave."
                : "Non-partners stay at Zero — no discounts. Join the partnership to unlock the paid strategies."}
            </p>
          </div>
        )}
      </div>

      {/* Action footer — pessimistic membership writes keep the dialog
            open with a busy primary; failures render here as an alert. */}
      <div className="border-border flex flex-col gap-2 border-t p-4">
        {error && (
          <p role="alert" className="text-destructive type-label font-medium">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isCurrent || busy || kind === "locked"}
            onClick={onConfirm}
            className={cx(
              "inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 type-body font-bold transition disabled:opacity-70",
              isCurrent || kind === "locked"
                ? "border-border text-muted-foreground border"
                : !member || paid
                  ? cx(
                      "bg-gradient-to-r text-white hover:brightness-105 active:scale-[0.99]",
                      art.cta || "from-slate-600 to-slate-500",
                    )
                  : "border-border text-foreground hover:bg-muted border",
            )}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              isCurrent && <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            {primaryLabel}
          </button>
        </div>
        {footerNote && (
          <p className="text-muted-foreground type-meta leading-snug">
            {footerNote}
          </p>
        )}
      </div>
    </dialog>
  );
}

function ModalLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground type-meta font-bold tracking-[0.14em] uppercase">
      {children}
    </span>
  );
}

// One numbered step in the modal's "How it works" flow.
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-foreground text-background mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full type-label font-bold tabular-nums">
        {n}
      </span>
      <div className="flex flex-col">
        <p className="text-foreground/90 type-body leading-snug font-semibold">
          {title}
        </p>
        {children && (
          <p className="text-muted-foreground type-label leading-snug">
            {children}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function MembershipStatusPill({ state }: { state: MembershipPillState }) {
  const labels: Record<MembershipPillState, string> = {
    not_member: "Not a partner",
    pending: "Partner — pending",
    live: "Partner — live",
    paused: "Paused",
    forfeited: "Forfeited",
  };
  const liveish = state === "live" || state === "pending";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 type-meta font-bold tracking-wide uppercase",
        state === "forfeited" && "bg-destructive/10 text-destructive",
        state === "paused" && "bg-amber-500/12 text-amber-800",
        liveish && "bg-emerald-500/12 text-emerald-700",
        state === "not_member" && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          state === "forfeited" && "bg-destructive",
          state === "paused" && "bg-amber-500",
          liveish && "bg-emerald-500",
          state === "not_member" && "bg-muted-foreground/50",
        )}
      />
      {labels[state]}
    </span>
  );
}
