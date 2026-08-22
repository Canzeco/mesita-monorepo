"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  Check,
  ChevronDown,
  CircleHelp,
  Loader2,
  Percent,
  TrendingUp,
  X,
} from "lucide-react";
import {
  DISCOUNT_CAPS_MXN,
  DEFAULT_DISCOUNT_CAP_MXN,
  STRATEGIES,
  STRATEGY_BY_ID,
  snapDiscountCap,
  strategyForPlace,
  type DiscountCapMxn,
  type Strategy,
  type StrategyId,
} from "@/lib/business/strategies";
import { planForSubscription } from "@/lib/business/plans";
import { getPromosConfig } from "@/app/(app)/rewards-config/actions";
import {
  ACTION_KEYS,
  ACTION_META,
  CLASS_KEYS,
  CLASS_META,
  DEFAULT_PROMOS,
  RATE_MAX,
  totalFor,
  type ActionKey,
  type ClassKey,
  type PlanKey,
  type PromosConfig,
  type StrategyKey,
} from "@/app/(app)/rewards-config/promos";
import { setPlacePlan, setPlaceStrategy, type AdminPlace } from "../actions";
import { ConfirmDialog, SectionCard } from "../ui";
import { ErrorNote } from "@/components/ErrorNote";
import {
  METER_SEGMENTS,
  describeMembershipStatus,
  effectiveStrikeCount,
  giveLevel,
  isMemberPlan,
  lifecycleView,
  membershipPillState,
  promoCardState,
  visibilityDots,
  type CardState,
  type LifecycleStepState,
  type MembershipPillState,
} from "./promo-state";

// Admin Promos — banner + three boxes (MESITA-912 membership unbundle,
// re-cut for density 2026-08-09):
//   0. Lifecycle banner — the canonical three steps (join → pick a strategy →
//      honor guest checks) as a one-line rail plus ONE detail line for the
//      step you're actually on; collapses to a slim strip once the place is
//      live on a paid strategy. THE one numbered lifecycle story on the page —
//      the modal steps mirror its titles, never fork them.
//   1. Membership — MX$1,000/year unlocks paid strategies (Zero stays free).
//      Status pill, drop, rules in disclosure. Admin writes plan — no Stripe.
//   2. Strategy — three ABSTRACT cards: a give meter and a placement meter,
//      nothing else. The 4×5 rate matrix and every rule live one tap deeper,
//      in the card's modal. Non-members: tap a paid card to join with that
//      posture. Members: free switch.
//   3. FAQs — how the model works, Premium worked example under CURRENT
//      strategy.

const MEMBERSHIP_PRICE_MXN = 1000;

// The free, no-discount strategy — the "leaving"/"not paid" boundary checked
// throughout this file.
const ZERO_STRATEGY_ID: StrategyId = "zero";

// Sample ticket for the worked example — deliberately above the discount cap
// so the "first MX$500" rule is visible in the math.
const EXAMPLE_BILL_MXN = 700;

// Per-strategy visual identity. Art = generated 1:1 abstract waves (no text
// in pixels — copy stays HTML); the gradient paints behind the image so a
// slow or missing asset still renders a branded band. `meter`/`accent` carry
// the identity into the two card meters.
const CARD_ART: Record<
  StrategyId,
  { src: string; fallback: string; cta: string; meter: string; accent: string }
> = {
  zero: {
    src: "/promos/strategy-zero.jpg",
    fallback: "from-slate-800 to-slate-500",
    cta: "",
    meter: "bg-slate-400",
    accent: "text-slate-500",
  },
  conservative: {
    src: "/promos/strategy-conservative.jpg",
    fallback: "from-emerald-900 to-teal-500",
    cta: "from-emerald-600 to-teal-500",
    meter: "bg-emerald-500",
    accent: "text-emerald-600",
  },
  aggressive: {
    src: "/promos/strategy-aggressive.jpg",
    fallback: "from-red-800 to-orange-500",
    cta: "from-red-600 to-orange-500",
    meter: "bg-orange-500",
    accent: "text-orange-600",
  },
  // No art file yet — the gradient IS the fallback, which is why it exists.
  // Violet reads as the rung above orange without colliding with any other
  // strategy on the rail.
  dominant: {
    src: "/promos/strategy-dominant.jpg",
    fallback: "from-violet-900 to-fuchsia-500",
    cta: "from-violet-600 to-fuchsia-500",
    meter: "bg-violet-500",
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

function displayCapMxn(place: AdminPlace): DiscountCapMxn {
  return snapDiscountCap(place.monthly_promo_cap);
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
  // Membership writes — join, reinstate, drop — are PESSIMISTIC: they apply
  // on EF success only, so the pill and cards never render a half-state
  // mid-write. Errors follow the gesture: switch failures land under the
  // grid, join/reinstate failures inside the modal, drop failures inside
  // the confirm dialog.

  const [switchPending, startSwitch] = useTransition();
  const [capPending, startCap] = useTransition();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [modalId, setModalId] = useState<StrategyId | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropBusy, setDropBusy] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  // The promos matrix, read LIVE from promos_config (rates are never cached
  // in code — MESITA-859), v11 shape since MESITA-1069. Identity defaults
  // render until the fetch lands, so the cards never flash empty; on failure
  // they keep the defaults and the grid carries a quiet "showing defaults"
  // note.
  const [matrix, setMatrix] = useState<PromosConfig>(DEFAULT_PROMOS);
  const [matrixFailed, setMatrixFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getPromosConfig();
      if (!active) return;
      if (r.ok) setMatrix(r.config);
      else setMatrixFailed(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const member = isMemberPlan(v.plan);
  const pillState = membershipPillState(v);
  const storedStrategy = strategyForPlace(v);
  const forfeited = pillState === "forfeited";
  const placeCap = displayCapMxn(v);
  const showCapPicker =
    member && !forfeited && storedStrategy !== ZERO_STRATEGY_ID;

  const applyPlace = (next: AdminPlace) => {
    setV(next);
    onSaved(next);
  };

  const revertPlace = (prev: AdminPlace) => {
    setV(prev);
    onSaved(prev);
  };

  // Join and Reinstate share the same door (setPlacePlan; the EF clears the
  // forfeit stamp + strikes on re-grant). The modal stays open with a busy
  // primary until the write settles.
  const commitJoin = async (target: StrategyId) => {
    if (modalBusy || member) return;
    const rates = strategySwitchPatch(target, v, storedStrategy);
    const plan = planForSubscription("pro_discount");

    setModalBusy(true);
    setModalError(null);
    const r = await setPlacePlan(v.id, plan, rates);
    setModalBusy(false);
    if (!r.ok) {
      setModalError(r.error);
      return;
    }
    applyPlace(r.data);
    setModalId(null);
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

  const commitCap = (cap: DiscountCapMxn) => {
    if (capPending || !showCapPicker || cap === placeCap) return;
    const prev = v;
    const optimistic: AdminPlace = { ...v, monthly_promo_cap: cap };
    applyPlace(optimistic);
    setSwitchError(null);

    startCap(async () => {
      const r = await setPlaceStrategy(prev.id, { monthly_promo_cap: cap });
      if (!r.ok) {
        revertPlace(prev);
        setSwitchError(r.error);
        return;
      }
      applyPlace(r.data);
    });
  };

  const onCardOpen = (id: StrategyId) => {
    setModalError(null);
    setModalId(id);
  };

  const onModalConfirm = (target: StrategyId) => {
    if (!member) {
      void commitJoin(target);
      return;
    }
    commitSwitch(target);
  };

  const onModalClose = () => {
    if (modalBusy) return;
    setModalId(null);
    setModalError(null);
  };

  const modalStrategy = modalId ? STRATEGY_BY_ID[modalId] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Box 0 · Lifecycle banner ───────────────────────────────────── */}
      <LifecycleBanner
        place={v}
        pillState={pillState}
        storedStrategy={storedStrategy}
        member={member}
      />

      {/* ── Box 1 · Membership ─────────────────────────────────────────── */}
      <MembershipBox
        place={v}
        pillState={pillState}
        onDropClick={() => {
          setDropError(null);
          setDropOpen(true);
        }}
      />

      {/* ── Box 2 · Strategy ───────────────────────────────────────────── */}
      <SectionCard
        icon={<TrendingUp className="h-4 w-4" />}
        tint="violet"
        title="Strategy"
        action={
          switchPending || capPending ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          ) : undefined
        }
      >
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STRATEGIES.map((s) => (
            <StrategyCard
              key={s.id}
              strategy={s}
              matrix={matrix}
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

        {showCapPicker && (
          <DiscountCapPicker
            cap={placeCap}
            currency={v.currency}
            pending={capPending}
            onSelect={commitCap}
          />
        )}

        {(matrixFailed || (storedStrategy === null && member)) && (
          <p className="text-muted-foreground mt-2.5 text-[11px]">
            {matrixFailed
              ? "Live rates unavailable — showing defaults."
              : "Current rates don't match a strategy — pick one to standardize."}
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

      {/* ── Box 3 · FAQs ───────────────────────────────────────────────── */}
      <FaqsBox
        place={v}
        storedStrategy={storedStrategy}
        member={member}
        capMxn={placeCap}
        matrix={matrix}
      />

      {modalStrategy && (
        <ProductModal
          strategy={modalStrategy}
          matrix={matrix}
          currency={v.currency}
          state={promoCardState({
            member,
            forfeited,
            storedStrategy,
            cardId: modalStrategy.id,
            paid: modalStrategy.id !== ZERO_STRATEGY_ID,
          })}
          member={member}
          busy={modalBusy}
          error={modalError}
          onConfirm={() => onModalConfirm(modalStrategy.id)}
          onClose={onModalClose}
        />
      )}

      <ConfirmDialog
        open={dropOpen}
        danger
        busy={dropBusy}
        error={dropError}
        title="Drop membership?"
        body="Ends the membership and clears activation — re-joining restarts pending activation. Strikes and any active pause carry over if the place re-joins."
        confirmLabel="Drop membership"
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

// ─── Box 0 · Lifecycle banner — the canonical three-step story ─────────────
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
  join: "Join the membership",
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
      <section className="border-border bg-card shadow-card rounded-2xl border px-5 py-3 sm:px-6">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
          <span
            aria-hidden
            className={cx(
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

  // Helper copy per step, keyed off the derived state + pill. Only the active
  // step's line renders.
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

  // Exactly one step is blocked-or-current in every rail state (see
  // lifecycleView) — that one carries the line.
  const active =
    steps.find((s) => s.state === "blocked") ??
    steps.find((s) => s.state === "current");

  return (
    <section className="border-border bg-card shadow-card rounded-2xl border px-5 py-4 sm:px-6">
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

// ─── Box 1 · Membership ────────────────────────────────────────────────────

const STRIKES: { n: string; consequence: string }[] = [
  { n: "1", consequence: "A warning — your discounts keep running." },
  { n: "2", consequence: "Your discounts are paused for 30 days." },
  {
    n: "3",
    consequence:
      "Membership forfeited — promos off, place stays listed on Mesita.",
  },
];

function MembershipBox({
  place,
  pillState,
  onDropClick,
}: {
  place: AdminPlace;
  pillState: MembershipPillState;
  onDropClick: () => void;
}) {
  // Pending's note lives in the lifecycle banner now (absorption rule) —
  // repeating it here would put two identical amber banners in the same
  // viewport. The paused/forfeited/strike notes stay: they carry dates and
  // consequences.
  const statusNote =
    pillState === "pending" ? null : describeMembershipStatus(place, pillState);
  const price = formatMoney(MEMBERSHIP_PRICE_MXN, place.currency);
  const notMember = pillState === "not_member";
  const forfeited = pillState === "forfeited";
  const canDrop = !notMember && !forfeited;
  // Decay-aware: raw strike_count keeps stale values until the EF lazily
  // rewrites it; the disclosure must not auto-open over phantom strikes.
  const strikes = effectiveStrikeCount(place);
  const rulesOpen =
    pillState === "paused" ||
    pillState === "forfeited" ||
    (strikes > 0 && pillState === "live");

  // One contextual line — the price and what it unlocks are already stated
  // once above it; this only says what to do next.
  const nextLine = notMember
    ? "Choose a strategy below to join. Rank is never for sale — visibility rises with what you give."
    : forfeited
      ? "Re-join by picking a strategy below — reinstating clears the forfeit and strikes; activation is earned again."
      : "Switching to Zero pauses discounts without ending the membership. Dropping is separate.";

  return (
    <SectionCard
      icon={<Percent className="h-4 w-4" />}
      tint="pink"
      title="Mesita Membership"
      action={<MembershipStatusPill state={pillState} />}
    >
      <div className="mt-4 flex flex-col gap-3">
        {statusNote && (
          <p
            className={cx(
              "rounded-xl px-3 py-2 text-[12px] leading-snug",
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
            <span className="text-muted-foreground text-[12px] font-normal">
              {" "}
              / year
            </span>
          </p>
          <p className="text-muted-foreground text-[12.5px] leading-snug">
            Unlocks{" "}
            <span className="text-foreground font-semibold">Conservative</span>{" "}
            and{" "}
            <span className="text-foreground font-semibold">Aggressive</span> —
            switch free anytime. Zero stays free.
          </p>
        </div>

        <p className="text-muted-foreground text-[12px] leading-snug">
          {nextLine}
        </p>

        <details open={rulesOpen} className="border-border group border-t">
          <summary className="text-muted-foreground hover:text-foreground flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-[12px] font-semibold transition [&::-webkit-details-marker]:hidden">
            How it works
            <ChevronDown className="h-3.5 w-3.5 shrink-0 transition group-open:rotate-180" />
          </summary>
          {/* Activation lives in the lifecycle banner (Box 0) — only the
              strikes ladder and the admin-write note are unique here. */}
          <div className="text-muted-foreground flex flex-col gap-2.5 pb-3 text-[12px] leading-snug">
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase">
              If a guest is turned away
            </p>
            <ol className="flex flex-col gap-1">
              {STRIKES.map((s) => (
                <li key={s.n} className="flex items-start gap-2">
                  <span
                    className={cx(
                      "mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      s.n === "3"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/15 text-amber-700",
                    )}
                  >
                    {s.n}
                  </span>
                  <span className="text-foreground/80">{s.consequence}</span>
                </li>
              ))}
            </ol>
            <p>
              Admin writes plan directly — no Stripe charge from here. Strikes
              decay after 6 months clean.
            </p>
          </div>
        </details>

        {canDrop && (
          <button
            type="button"
            onClick={onDropClick}
            className="text-muted-foreground hover:text-destructive self-start text-[12px] font-semibold underline underline-offset-4 transition"
          >
            Drop membership
          </button>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Box 2 · Strategy card — two meters, nothing else ──────────────────────
//
// MESITA-999: the face used to carry the whole 4×5 rate matrix, three times
// over, which made the grid a spreadsheet you had to read before you could
// choose. It now answers the only two questions a posture has — how much do I
// give, what do I get — on one shared five-segment rail. Every number behind
// them is one tap away in the modal.

function StrategyCard({
  strategy,
  matrix,
  state,
  pending,
  onOpen,
}: {
  strategy: Strategy;
  matrix: PromosConfig;
  state: CardState;
  pending: boolean;
  onOpen: () => void;
}) {
  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== ZERO_STRATEGY_ID;
  const { selected, cta } = state;
  const give = giveLevel(matrix, strategy.id);
  const ariaState = selected
    ? " (current)"
    : cta === "reinstate"
      ? " (forfeited — reinstate)"
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
          <span className="text-foreground absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase shadow-card">
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
        <MeterStat
          label="You give"
          value={paid ? `~${give.mean}%` : "0%"}
          valueClass={paid ? art.accent : "text-muted-foreground"}
          dots={give.dots}
          meterClass={art.meter}
          note={
            paid
              ? `Projected average · 9 in 10 bills land ${give.p10}–${give.p90}%`
              : "No discounts — Zero is free."
          }
        />

        <MeterStat
          label="You get"
          value={`${strategy.visibility} visibility`}
          valueClass={paid ? art.accent : "text-muted-foreground"}
          dots={visibilityDots(strategy.visibility)}
          meterClass={art.meter}
          note="Placement in the discovery algorithm"
        />

        {/* Presentational CTA — the whole card is the button; the modal
            carries the real action. Every state names one honestly:
            Join (non-member, Zero included) · Reinstate (forfeited) ·
            Switch / Switch to Zero (member) · Current. */}
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          {cta === "current" ? (
            <span className="border-border text-muted-foreground inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border text-[12px] font-bold">
              <Check className="h-3.5 w-3.5" />
              Current
            </span>
          ) : (
            <span
              className={cx(
                "inline-flex h-11 w-full items-center justify-center rounded-full text-[12px] font-bold",
                paid
                  ? cx("bg-gradient-to-r text-white", art.cta)
                  : "border-border text-foreground/75 border",
              )}
            >
              {cta === "join"
                ? "Join"
                : cta === "reinstate"
                  ? "Reinstate"
                  : paid
                    ? "Switch"
                    : "Switch to Zero"}
            </span>
          )}
          <span className="text-muted-foreground group-hover:text-foreground text-center text-[10.5px] font-medium transition">
            See full rates & rules
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

/** Label · level · five-segment rail · one grounding line. */
function MeterStat({
  label,
  value,
  valueClass,
  dots,
  meterClass,
  note,
}: {
  label: string;
  value: string;
  valueClass: string;
  dots: number;
  meterClass: string;
  note: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
          {label}
        </span>
        <span
          className={cx(
            "font-display truncate text-[15px] leading-none font-bold tracking-tight",
            valueClass,
          )}
        >
          {value}
        </span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: METER_SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={cx(
              "h-1.5 flex-1 rounded-full",
              i < dots ? meterClass : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-[11px] leading-snug">{note}</p>
    </div>
  );
}

// ─── Product modal — full detail + the action ───────────────────────────────

function ProductModal({
  strategy,
  matrix,
  currency,
  state,
  member,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  strategy: Strategy;
  matrix: PromosConfig;
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
  const give = giveLevel(matrix, strategy.id);

  const primaryLabel =
    kind === "current"
      ? "Current strategy"
      : kind === "join"
        ? `Join — ${price}/year`
        : kind === "reinstate"
          ? `Reinstate — ${price}/year`
          : kind === "switch"
            ? `Switch to ${strategy.name}`
            : "Switch to Zero";

  const footerNote =
    kind === "current"
      ? ""
      : kind === "join"
        ? `Starts membership at ${price}/year with ${strategy.name} rates. Admin write — no Stripe charge.`
        : kind === "reinstate"
          ? paid
            ? "Clears the forfeit and strikes; membership restarts in pending activation."
            : "Clears the forfeit and strikes; reinstates the membership with no discounts — promo lane stays closed until a paid strategy is picked."
          : kind === "switch_zero"
            ? "Membership stays active; discounts pause. Promo lane closes until you pick a paid strategy again."
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
          <span className="text-foreground absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase shadow-card">
            <Check className="h-3 w-3" />
            Current
          </span>
        )}
      </ArtBand>

      {/* Detail — everything the card abstracts away. */}
      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        <p className="text-muted-foreground text-[13px] leading-snug">
          {strategy.tagline}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <MeterStat
            label="You give"
            value={paid ? `~${give.mean}%` : "0%"}
            valueClass={paid ? art.accent : "text-muted-foreground"}
            dots={give.dots}
            meterClass={art.meter}
            note={paid ? "Projected avg / bill" : "No discounts"}
          />
          <MeterStat
            label="You get"
            value={strategy.visibility}
            valueClass={paid ? art.accent : "text-muted-foreground"}
            dots={visibilityDots(strategy.visibility)}
            meterClass={art.meter}
            note="Algorithm placement"
          />
        </div>

        {paid ? (
          <>
            <div className="flex flex-col gap-2">
              <ModalLabel>Every rate</ModalLabel>
              <RewardsMatrix matrix={matrix} strategy={strategy.id} />
            </div>

            <div className="flex flex-col gap-3">
              {/* Canonical step titles — mirror the page banner (Box 0),
                  with per-strategy detail lines. Never fork the wording. */}
              <ModalLabel>How it works</ModalLabel>
              <Step n={1} title="Join the membership">
                {price}/year — one fee, switch strategies free anytime.
              </Step>
              <Step n={2} title="Pick a strategy">
                Confirming makes {strategy.name} your posture — switch free
                anytime.
              </Step>
              <Step n={3} title="Honor guest checks">
                We ping your staff WhatsApp, then honoring the first guest check
                at the bill makes you live.
              </Step>
              <p className="text-muted-foreground text-[10px] leading-snug">Refusing a guest is a strike: 1 warning · 2 paused 30 days · 3 removed.</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <ModalLabel>How it works</ModalLabel>
            <p className="text-muted-foreground text-[12px] leading-snug">
              {member
                ? "Zero pauses discounts — membership stays active. Drop membership separately if you want to leave."
                : "Non-members stay at Zero — no discounts. Join membership to unlock the paid strategies."}
            </p>
          </div>
        )}
      </div>

      {/* Action footer — pessimistic membership writes keep the dialog
            open with a busy primary; failures render here as an alert. */}
      <div className="border-border flex flex-col gap-2 border-t p-4">
        {error && (
          <p role="alert" className="text-destructive text-[11px] font-medium">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isCurrent || busy}
            onClick={onConfirm}
            className={cx(
              "inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-[13px] font-bold transition disabled:opacity-70",
              isCurrent
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
          <p className="text-muted-foreground text-[10px] leading-snug">
            {footerNote}
          </p>
        )}
      </div>
    </dialog>
  );
}

function ModalLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
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
      <span className="bg-foreground text-background mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums">
        {n}
      </span>
      <div className="flex flex-col">
        <p className="text-foreground/90 text-[13px] leading-snug font-semibold">
          {title}
        </p>
        {children && (
          <p className="text-muted-foreground text-[11px] leading-snug">
            {children}
          </p>
        )}
      </div>
    </div>
  );
}

// The v7 Strategy × Class matrix at this strategy (MESITA-862, replaces the
// retired 2×2): rows = guest classes, columns = None (standing) + the four
// rewarded actions, read live from promos_config. Story is universal
// (MESITA-909) — every class row shows its priced cell; eligibility is
// Instagram-connected at the consumer EF layer. Rates live in HTML text,
// never artwork. Modal-only since MESITA-999 — the card face abstracts it
// into the give meter.
function RewardsMatrix({
  matrix,
  strategy,
}: {
  matrix: PromosConfig;
  strategy: StrategyId;
}) {
  const cell = (v: number) => (v > 0 ? `${v}%` : "—");
  const shortClass: Record<ClassKey, string> = {
    bronze: "Bronze",
    silver: "Silver",
    gold: "Gold",
    diamond: "Diamond",
  };
  // Zero has no rules — it is off by definition, and this table is only shown
  // for the paid strategies anyway.
  const paidStrategy = strategy === "zero" ? null : strategy;
  const shortAction: Record<ActionKey, string> = {
    standing: "None",
    mesita_review: ACTION_META.mesita_review.emoji,
    story: ACTION_META.story.emoji,
    welcome: ACTION_META.welcome.emoji,
    review: ACTION_META.review.emoji,
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="border-border/60 grid grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))] overflow-hidden rounded-lg border text-[10.5px]">
        <span className="bg-muted/40 px-2 py-1.5" aria-hidden />
        {ACTION_KEYS.map((a) => (
          <span
            key={a}
            title={ACTION_META[a].name}
            className="text-muted-foreground bg-muted/40 px-1 py-1.5 text-center font-semibold"
          >
            {shortAction[a]}
          </span>
        ))}
        {CLASS_KEYS.map((cls) => (
          <div key={cls} className="contents">
            <span
              className="text-muted-foreground border-border/60 truncate border-t px-2 py-1.5 font-medium"
              title={CLASS_META[cls].name}
            >
              {CLASS_META[cls].emoji} {shortClass[cls]}
            </span>
            {ACTION_KEYS.map((a) => (
              <span
                key={a}
                className="text-foreground/80 border-border/60 border-t px-1 py-1.5 text-center font-bold tabular-nums"
              >
                {!paidStrategy
                  ? "—"
                  : cell(
                      Math.min(
                        RATE_MAX,
                        // The class ladder at the Free plan — the floor for
                        // that class. Plan is the other axis and is never
                        // attributed to a guest here.
                        totalFor(matrix, paidStrategy, cls, "free", a),
                      ),
                    )}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="text-muted-foreground/80 text-[10px] leading-snug">
        {ACTION_KEYS.map(
          (a, i) =>
            `${i > 0 ? " · " : ""}${ACTION_META[a].emoji} ${ACTION_META[a].name}`,
        ).join("")}
      </p>
    </div>
  );
}

// ─── Box 3 · FAQs — how the membership works, with real numbers ────────────

function FaqsBox({
  place,
  storedStrategy,
  member,
  capMxn,
  matrix,
}: {
  place: AdminPlace;
  storedStrategy: StrategyId | null;
  member: boolean;
  capMxn: DiscountCapMxn;
  matrix: PromosConfig;
}) {
  const currency = place.currency;
  const price = formatMoney(MEMBERSHIP_PRICE_MXN, currency);
  const cap = formatMoney(capMxn, currency);
  const exampleSavesMxn = capMxn * 0.5;

  return (
    <SectionCard
      icon={<CircleHelp className="h-4 w-4" />}
      tint="sky"
      title="FAQs"
    >
      {/* One divided list, everything closed: the answers are reference, not
          reading. The worked example opens first because it is the only one
          that shows this place's own numbers. */}
      <div className="border-border/60 divide-border/60 mt-4 divide-y overflow-hidden rounded-xl border">
        <Faq q="What does a Premium guest actually get?" defaultOpen>
          <PremiumExamples
            place={place}
            storedStrategy={storedStrategy}
            matrix={matrix}
          />
        </Faq>

        <Faq q={`What exactly does the ${price}/year buy?`}>
          <p>
            The right to leave Zero. Membership unlocks Conservative and
            Aggressive — pick either, switch free anytime while you&apos;re a
            member. Zero stays free with no discounts. Being listed on Mesita
            never costs anything, member or not. The fee is a commitment filter
            (keeps half-hearted places out of rewards), not a feature tier and
            not a rank you can buy.
          </p>
        </Faq>

        <Faq q="Can I switch strategies — or move to Zero?">
          <p>
            Yes — free, anytime, while your membership is active. Strategy is
            the discount posture you promise guests; switching only changes your
            rates. New tickets pick up the new rates; open tickets keep what
            they were created with.
          </p>
          <p>
            Switching to Zero pauses discounts: membership stays active,
            activation state and strikes carry on, but the promo lane closes and
            visibility drops to Low. Cancelling membership is a separate action
            in the Membership box.
          </p>
        </Faq>

        <Faq q="How does visibility work?">
          <p>
            The ranking algorithm reads a stronger discount as a stronger card:
            Zero sits at Low, Conservative at Mid, Aggressive at High.
            Visibility is never a separate knob you can buy — it rises with what
            you give.
          </p>
        </Faq>

        <Faq q={`What is the ${cap} cap?`}>
          <p>
            Every discount applies only to the first {cap} of the bill — a
            per-place choice (MX$200, MX$500, or MX$1,000), always shown to
            guests. Example: 50% off a{" "}
            {formatMoney(EXAMPLE_BILL_MXN, currency)} bill touches the first{" "}
            {cap}, so the guest saves {formatMoney(exampleSavesMxn, currency)}{" "}
            and pays {formatMoney(EXAMPLE_BILL_MXN - exampleSavesMxn, currency)}
            . The headline stays big; the cost stays bounded.
          </p>
        </Faq>

        <Faq q="How does a place activate?">
          <p>
            Two steps: the staff WhatsApp channel passes a test ping, and the
            first guest ticket is honored at the bill. Mesita runs both — no
            self-serve switch.
          </p>
        </Faq>

        <Faq q="What happens if a guest is turned away?">
          <p>
            A refused or ignored QR is a strike: 1 — warning and the activation
            test re-runs · 2 — your discounts pause for 30 days · 3 — membership
            forfeited (the place stays listed on Mesita). Strikes decay after 6
            months clean, and the turned-away guest is compensated instantly.
          </p>
        </Faq>

        <Faq q="How do I cancel membership?">
          <p>
            Use Drop membership in the Membership box — it clears your plan and
            rates.{" "}
            {member
              ? "You are currently a member."
              : "You are not currently a member."}
          </p>
        </Faq>
      </div>
    </SectionCard>
  );
}

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

// The Premium-guest worked example.
//
// MESITA-1001: this used to compute from the place's `*_rate` COLUMNS. Since
// the engine went additive-v10 (MESITA-992) `resolveTicketRate` never reads
// those columns — they only carry strategy IDENTITY now — so the example was
// quoting pre-v10 numbers. On Aggressive that under-reported returning visits
// by 10 points (Standard 10 vs the 20 the engine pays, Premium 30 vs 40).
// Read the live v10 config instead, exactly like the engine does.
function PremiumExamples({
  place,
  storedStrategy,
  matrix,
}: {
  place: AdminPlace;
  storedStrategy: StrategyId | null;
  matrix: PromosConfig;
}) {
  const paidStrategy =
    storedStrategy && storedStrategy !== ZERO_STRATEGY_ID
      ? (storedStrategy as StrategyKey)
      : null;
  const strategy = storedStrategy ? STRATEGY_BY_ID[storedStrategy] : null;
  const cap = place.monthly_promo_cap ?? DEFAULT_DISCOUNT_CAP_MXN;

  // Welcome is the automatic first-ticket bonus; returning is the bare base.
  // The two example rows are the PLAN axis (v11) at the base class: what the
  // same Bronze guest pays on Free versus on the paid subscription.
  const rate = (plan: PlanKey, welcome: boolean) =>
    paidStrategy
      ? Math.min(
          RATE_MAX,
          matrix.visits.base[paidStrategy].bronze[plan] +
            (welcome ? matrix.visits.bonuses[paidStrategy].welcome : 0),
        )
      : null;

  if (!paidStrategy) {
    return (
      <p className="text-muted-foreground leading-snug">
        No promos right now — Premium guests see this place in the catalog with
        no discount card. Pick a strategy above to preview the deal.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <p className="text-foreground/80">
          Current rates on a sample{" "}
          {formatMoney(EXAMPLE_BILL_MXN, place.currency)} ticket:
        </p>
        <span className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
          {strategy && strategy.id !== ZERO_STRATEGY_ID
            ? `${strategy.emoji} ${strategy.name}`
            : "Custom rates"}
        </span>
      </div>
      <div className="border-border/60 divide-border/60 divide-y rounded-lg border">
        <ExampleRow
          visit="Welcome"
          premiumRate={rate("premium", true)}
          freeRate={rate("free", true)}
          cap={cap}
          currency={place.currency}
        />
        <ExampleRow
          visit="Returning"
          premiumRate={rate("premium", false)}
          freeRate={rate("free", false)}
          cap={cap}
          currency={place.currency}
        />
      </div>
      <p>
        Premium ≥ Free in every strategy — subscribers always get the better
        deal. They are what the membership buys. Action bonuses (story,
        reviews) stack on top of these.
      </p>
    </>
  );
}

function ExampleRow({
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
  currency: string | null;
}) {
  // The discount only touches the first `cap` of the ticket.
  const base = Math.min(EXAMPLE_BILL_MXN, cap);
  const saves =
    premiumRate == null ? 0 : Math.round((base * premiumRate) / 100);
  const pays = EXAMPLE_BILL_MXN - saves;
  const freeSaves = freeRate == null ? 0 : Math.round((base * freeRate) / 100);

  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <span className="text-muted-foreground shrink-0 text-[11px] font-bold tracking-wide uppercase">
        {visit}
      </span>
      {premiumRate == null ? (
        <span className="text-muted-foreground text-[11px]">
          No discount for this visit type.
        </span>
      ) : (
        <div className="text-right">
          <p className="text-foreground/85 text-[12px]">
            Premium{" "}
            <span className="font-bold tabular-nums">{premiumRate}%</span> →
            pays{" "}
            <span className="font-bold">{formatMoney(pays, currency)}</span>,
            saves {formatMoney(saves, currency)}
          </p>
          <p className="text-muted-foreground text-[11px]">
            {freeRate == null
              ? "Standard gets no discount on this visit."
              : `Standard ${freeRate}% → saves ${formatMoney(freeSaves, currency)}`}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Discount cap picker — independent of strategy ─────────────────────────

function DiscountCapPicker({
  cap,
  currency,
  pending,
  onSelect,
}: {
  cap: DiscountCapMxn;
  currency: string | null;
  pending: boolean;
  onSelect: (cap: DiscountCapMxn) => void;
}) {
  return (
    <div className="border-border/60 mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-xl border px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-foreground/90 text-[12px] font-semibold">
          Discount cap
        </p>
        <p className="text-muted-foreground text-[11px] leading-snug">
          Every discount applies to the first N pesos of the bill — separate
          from strategy.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {pending && (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        )}
        {DISCOUNT_CAPS_MXN.map((option) => {
          const active = cap === option;
          return (
            <button
              key={option}
              type="button"
              disabled={pending}
              onClick={() => onSelect(option)}
              aria-pressed={active}
              className={cx(
                "inline-flex h-9 items-center rounded-lg px-3 text-[12.5px] tabular-nums transition disabled:opacity-50",
                active
                  ? "bg-foreground text-background font-bold"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted border font-semibold",
              )}
            >
              {formatMoney(option, currency)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function MembershipStatusPill({ state }: { state: MembershipPillState }) {
  const labels: Record<MembershipPillState, string> = {
    not_member: "Not a member",
    pending: "Member — pending",
    live: "Member — live",
    paused: "Paused",
    forfeited: "Forfeited",
  };
  const liveish = state === "live" || state === "pending";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
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
