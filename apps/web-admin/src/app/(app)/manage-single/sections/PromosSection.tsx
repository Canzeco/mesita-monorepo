"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  Check,
  ChevronDown,
  CircleHelp,
  Coins,
  Crown,
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
  STRATEGY_VISIBILITY_LADDER,
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
  totalFor,
  type ActionKey,
  type ClassKey,
  type PromosConfig,
} from "@/app/(app)/rewards-config/promos";
import { setPlacePlan, setPlaceStrategy, type AdminPlace } from "../actions";
import { ConfirmDialog, SectionCard } from "../ui";
import { ErrorNote } from "@/components/ErrorNote";
import {
  describeMembershipStatus,
  effectiveStrikeCount,
  isMemberPlan,
  lifecycleView,
  membershipPillState,
  promoCardState,
  type CardState,
  type LifecycleStepState,
  type MembershipPillState,
} from "./promo-state";

// Admin Promos — stepper banner + three boxes (MESITA-912 membership unbundle):
//   0. Lifecycle stepper — the canonical three steps (join → pick a strategy →
//      honor guest checks) as a live rail; collapses to a slim strip once the
//      place is live on a paid strategy. THE one numbered lifecycle story on
//      the page — the modal steps mirror its titles, never fork them.
//   1. Membership — MX$1,000/year unlocks paid strategies (Zero stays free).
//      Status pill, drop, rules in disclosure. Admin writes plan — no Stripe.
//      Its pending statusNote is absorbed by stepper step 3.
//   2. Strategy — three cards (give/receive). Non-members: tap Join on a
//      paid card to start membership with that posture. Members: free switch.
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
// slow or missing asset still renders a branded band.
// `meter`/`recvText`/`recvBg`/`recvBorder` also drive the "You receive" reward
// panel — the payoff, colored in the strategy's own accent (MESITA-592).
const CARD_ART: Record<
  StrategyId,
  {
    src: string;
    fallback: string;
    cta: string;
    meter: string;
    recvText: string;
    recvBg: string;
    recvBorder: string;
  }
> = {
  zero: {
    src: "/promos/strategy-zero.jpg",
    fallback: "from-slate-800 to-slate-500",
    cta: "",
    meter: "bg-slate-400",
    recvText: "text-slate-500",
    recvBg: "bg-muted/40",
    recvBorder: "border-border/60",
  },
  conservative: {
    src: "/promos/strategy-conservative.jpg",
    fallback: "from-emerald-900 to-teal-500",
    cta: "from-emerald-600 to-teal-500",
    meter: "bg-emerald-500",
    recvText: "text-emerald-600",
    recvBg: "bg-emerald-500/[0.07]",
    recvBorder: "border-emerald-500/25",
  },
  aggressive: {
    src: "/promos/strategy-aggressive.jpg",
    fallback: "from-red-800 to-orange-500",
    cta: "from-red-600 to-orange-500",
    meter: "bg-orange-500",
    recvText: "text-orange-600",
    recvBg: "bg-orange-500/[0.07]",
    recvBorder: "border-orange-500/25",
  },
};

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

function formatMoney(amount: number, currency: string | null): string {
  const prefix = !currency || currency === "MXN" ? "MX$" : "$";
  return `${prefix}${amount.toLocaleString("en-US")}`;
}

// Membership/pill/card state derivations live in ./promo-state (pure module,
// unit-tested — see promo-state.test.ts).

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
  // Strategy SWITCH stays optimistic (rates-only; the moving ring is the
  // feedback). Membership writes — join, reinstate, drop — are PESSIMISTIC:
  // they apply on EF success only, so the pill and cards never render a
  // half-state mid-write. Errors follow the gesture: switch failures land
  // under the grid, join/reinstate failures inside the modal, drop failures
  // inside the confirm dialog.
  const [switchPending, startSwitch] = useTransition();
  const [capPending, startCap] = useTransition();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [modalId, setModalId] = useState<StrategyId | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropBusy, setDropBusy] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  // The promos matrix, read LIVE from rewards_config (rates are never cached
  // in code — MESITA-859), v10 shape since MESITA-991. Identity defaults
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
    <div className="flex flex-col gap-5">
      {/* ── Box 0 · Lifecycle stepper ──────────────────────────────────── */}
      <LifecycleStepper
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
        subtitle="Three discount postures — switch free anytime while membership is active."
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
              currency={v.currency}
              capMxn={placeCap}
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

        {matrixFailed && (
          <p className="text-muted-foreground mt-2.5 text-[11px]">
            Live rates unavailable — showing defaults.
          </p>
        )}

        {storedStrategy === null && member && (
          <p className="text-muted-foreground mt-2.5 text-[11px]">
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

      {/* ── Box 3 · FAQs ───────────────────────────────────────────────── */}
      <FaqsBox place={v} storedStrategy={storedStrategy} member={member} capMxn={placeCap} />

      {modalStrategy && (
        <ProductModal
          strategy={modalStrategy}
          matrix={matrix}
          currency={v.currency}
          capMxn={placeCap}
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

// ─── Box 0 · Lifecycle stepper — the canonical three-step story ────────────
//
// Approved design: editorial rail (Variant C, plan-design-review 2026-08-09) —
// serif heading, per-step markers with a progress track, state chips. Live on
// a paid strategy collapses to a slim strip (the teaching job is done; strikes
// keep it honest). Non-interactive on purpose: the actionable controls stay in
// the Membership box and strategy cards. decision: the stepper does NOT repeat
// the MembershipStatusPill — the Membership box header keeps the only pill in
// the viewport.

const STEP_TITLES = {
  join: "Join the membership",
  strategy: "Pick a strategy",
  honor: "Honor guest checks",
} as const;

function LifecycleStepper({
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
      <section className="border-border bg-card shadow-card rounded-2xl border px-5 py-3.5 sm:px-6">
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

  // Helper copy per step, keyed off the derived state + pill.
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
            {/* Marker */}
            <span className="absolute top-0 left-0">
              <StepMarker n={i + 1} state={s.state} danger={forfeited} />
            </span>
            {/* Connector — vertical on mobile, horizontal track on sm+ */}
            {i < steps.length - 1 && (
              <>
                <span
                  aria-hidden
                  className={cx(
                    "absolute top-7 -bottom-4 left-[11px] w-px sm:hidden",
                    steps[i + 1].state === "upcoming"
                      ? "bg-border"
                      : "bg-emerald-500/60",
                  )}
                />
                <span
                  aria-hidden
                  className={cx(
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
              className={cx(
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

// One stepper marker: done ✓ (emerald) · current (amber ring) · blocked
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
      <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3 w-3" aria-hidden />
        <span className="sr-only">Step {n} done</span>
      </span>
    );
  }
  return (
    <span
      className={cx(
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

// ─── Membership box ────────────────────────────────────────────────────────

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
  // Pending's note lives in stepper step 3 now (absorption rule) — repeating
  // it here would put two identical amber banners in the same viewport. The
  // paused/forfeited/strike notes stay: they carry dates and consequences.
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

  return (
    <SectionCard
      icon={<Percent className="h-4 w-4" />}
      tint="pink"
      title="Mesita Membership"
      subtitle={`${price}/year unlocks paid strategies. Zero stays free.`}
      action={<MembershipStatusPill state={pillState} />}
    >
      <div className="mt-4 flex flex-col gap-4">
        {statusNote && (
          <p
            className={cx(
              "rounded-xl p-3 text-[12px] leading-snug",
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

        <div className="flex flex-col gap-1.5">
          <p className="font-display text-2xl font-semibold tracking-tight">
            {price}{" "}
            <span className="text-muted-foreground text-[12px] font-normal">
              / year
            </span>
          </p>
          <p className="text-foreground/85 text-[13px] leading-snug">
            Unlocks <span className="font-semibold">Conservative</span> and{" "}
            <span className="font-semibold">Aggressive</span>. Zero stays free.
            Switch strategies anytime while membership is active.
          </p>
          {notMember ? (
            <p className="text-muted-foreground text-[12px] leading-snug">
              <span className="text-foreground font-semibold">
                Choose a strategy below to join.
              </span>{" "}
              Rank is never for sale — visibility rises with what you give.
            </p>
          ) : forfeited ? (
            <p className="text-muted-foreground text-[12px] leading-snug">
              <span className="text-foreground font-semibold">
                Re-join by picking a strategy below.
              </span>{" "}
              Reinstating clears the forfeit and strikes; activation is earned
              again.
            </p>
          ) : (
            <p className="text-muted-foreground text-[12px] leading-snug">
              Membership stays on while you switch strategies, including Zero
              (pauses discounts). Drop membership separately if you want out.
            </p>
          )}
        </div>

        {canDrop && (
          <button
            type="button"
            onClick={onDropClick}
            className="border-border text-foreground/75 hover:bg-muted inline-flex h-11 items-center justify-center self-start rounded-full border px-4 text-[12px] font-bold transition"
          >
            Drop membership
          </button>
        )}

        <details open={rulesOpen} className="border-border group border-t pt-2">
          <summary className="text-foreground flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 text-[12px] font-semibold [&::-webkit-details-marker]:hidden">
            How it works
            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          {/* Activation lives in stepper step 3 (Box 0) — only the strikes
              ladder and the admin-write note are unique to this disclosure. */}
          <div className="text-muted-foreground flex flex-col gap-3 pb-1 pt-1 text-[12px] leading-snug">
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-bold tracking-[0.16em] uppercase">
                If a guest is turned away
              </p>
              <ol className="flex flex-col gap-1">
                {STRIKES.map((s) => (
                  <li key={s.n} className="flex items-start gap-2">
                    <span
                      className={cx(
                        "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
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
            </div>
            <p>
              Admin writes plan directly — no Stripe charge from here. Strikes
              decay after 6 months clean.
            </p>
          </div>
        </details>
      </div>
    </SectionCard>
  );
}

// ─── Strategy card — give/receive only; price lives in Membership box ──────

function StrategyCard({
  strategy,
  matrix,
  currency,
  capMxn,
  state,
  pending,
  onOpen,
}: {
  strategy: Strategy;
  matrix: PromosConfig;
  currency: string | null;
  capMxn: DiscountCapMxn;
  state: CardState;
  pending: boolean;
  onOpen: () => void;
}) {
  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== ZERO_STRATEGY_ID;
  const { selected, cta } = state;
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
        "bg-card relative flex flex-col overflow-hidden rounded-2xl border text-left transition",
        selected
          ? "border-foreground/70 ring-foreground/70 ring-2"
          : "border-border/60 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-20px_rgba(0,0,0,0.35)]",
      )}
    >
      {/* Art band — gradient behind the image is the loading/404 fallback;
          the scrim keeps the white name/price legible. */}
      <div
        className={cx(
          "relative h-28 w-full shrink-0 bg-gradient-to-br",
          art.fallback,
        )}
      >
        <Image
          src={art.src}
          alt=""
          fill
          sizes="(min-width:640px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
        {selected && (
          <span className="text-foreground absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase shadow-sm">
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Current
          </span>
        )}
        <div className="absolute inset-x-3.5 bottom-2.5">
          <p className="font-display truncate text-sm font-bold tracking-wide text-white uppercase drop-shadow-sm">
            <span className="mr-1" aria-hidden>
              {strategy.emoji}
            </span>
            {strategy.name}
          </p>
        </div>
      </div>

      {/* Give → receive → join (MESITA-590). No hero — the matrix IS the
          pitch, Welcome-first, capped, super simple. */}
      <div className="flex w-full flex-1 flex-col gap-3 p-3.5">
        <div className="flex flex-col gap-1.5">
          <ModalLabel>You give</ModalLabel>
          {paid ? (
            <>
              <p className="text-muted-foreground text-[11px] leading-snug">
                These discounts, capped at{" "}
                {formatMoney(capMxn, currency)} per bill:
              </p>
              <RewardsMatrix matrix={matrix} strategy={strategy.id} />
            </>
          ) : (
            <p className="text-muted-foreground text-[12px] leading-snug">
              Nothing — Zero is free. No discounts.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <ModalLabel>You receive</ModalLabel>
          <PlacementReward strategy={strategy} art={art} />
        </div>

        {/* Presentational CTA — the whole card is the button; the modal
            carries the real action. Every state names one honestly:
            Join (non-member, Zero included) · Reinstate (forfeited) ·
            Switch / Switch to Zero (member) · Current. */}
        <div className="mt-auto pt-1">
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
        </div>
      </div>
    </button>
  );
}

// ─── Product modal — full detail + the action ───────────────────────────────

function ProductModal({
  strategy,
  matrix,
  currency,
  capMxn,
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
  capMxn: DiscountCapMxn;
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
      className="border-border bg-card m-auto hidden max-h-[88vh] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border p-0 shadow-xl backdrop:bg-black/45 backdrop:backdrop-blur-sm open:flex max-sm:mt-auto max-sm:mb-4"
    >
      {/* Art header */}
      <div
        className={cx("relative h-32 shrink-0 bg-gradient-to-br", art.fallback)}
      >
        <Image
          src={art.src}
          alt=""
          fill
          sizes="28rem"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="absolute top-2.5 right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
        {isCurrent && (
          <span className="text-foreground absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase shadow-sm">
            <Check className="h-3 w-3" />
            Current
          </span>
        )}
        <div className="absolute inset-x-4 bottom-3">
          <p
            id="product-modal-title"
            className="font-display text-lg font-bold tracking-wide text-white uppercase drop-shadow-sm"
          >
            <span className="mr-1.5" aria-hidden>
              {strategy.emoji}
            </span>
            {strategy.name}
          </p>
        </div>
      </div>

      {/* Detail */}
      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        <p className="text-muted-foreground text-[13px] leading-snug">
          {strategy.tagline}
        </p>

        <div className="flex flex-col gap-2">
          <ModalLabel>You give</ModalLabel>
          {paid ? (
            <>
              <RewardsMatrix matrix={matrix} strategy={strategy.id} />
              <p className="text-muted-foreground text-[11px] leading-snug">
                Every discount applies to the first{" "}
                {formatMoney(capMxn, currency)} of the bill — the place&apos;s
                chosen cap, always shown to guests. A guest gets their single
                best qualifying rate, never a sum.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-[12px] leading-snug">
              Nothing — Zero is free. No discounts.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <ModalLabel>You receive</ModalLabel>
          <PlacementReward strategy={strategy} art={art} />
        </div>

        {paid ? (
          <div className="flex flex-col gap-3">
            {/* Canonical step titles — mirror the page stepper (Box 0),
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
            <p className="text-muted-foreground text-[10px] leading-snug">
              Turn a guest away and it&apos;s a strike — 1 warning · 2 discounts
              paused 30 days · 3 removed. Strikes decay after 6 months clean.
            </p>
          </div>
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
    <span className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
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
// rewarded actions, read live from rewards_config. Story is universal
// (MESITA-909) — every class row shows its priced cell; eligibility is
// Instagram-connected at the consumer EF layer. Rates live in HTML text,
// never artwork.
function RewardsMatrix({
  matrix,
  strategy,
}: {
  matrix: PromosConfig;
  strategy: StrategyId;
}) {
  const cell = (v: number) => (v > 0 ? `${v}%` : "—");
  const shortClass: Record<ClassKey, string> = {
    standard: "Standard",
    premium: "Premium",
    influencer: "Influencer",
    aura: "Aura",
  };
  // Zero has no rules — it is off by definition, and this card is only shown
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
                  : cell(Math.min(70, totalFor(matrix, paidStrategy, cls, a)))}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="text-muted-foreground/80 text-[10px] leading-snug">
        {ACTION_KEYS.map(
          (a, i) =>
            `${i > 0 ? " · " : ""}${ACTION_META[a].emoji} ${ACTION_META[a].name}`,
        ).join("")}{" "}
        · best rate wins
      </p>
    </div>
  );
}

// The "You receive" reward — the payoff, made the card's second visual anchor
// (MESITA-592): the placement level big in the strategy's own accent + a
// filled ladder, so what the membership BUYS reads louder than the mechanics.
function PlacementReward({
  strategy,
  art,
}: {
  strategy: Strategy;
  art: (typeof CARD_ART)[StrategyId];
}) {
  const idx = STRATEGY_VISIBILITY_LADDER.indexOf(strategy.visibility);
  return (
    <div
      className={cx(
        "flex flex-col gap-2 rounded-xl border p-3",
        art.recvBg,
        art.recvBorder,
      )}
    >
      <div className="flex items-center gap-2">
        <TrendingUp className={cx("h-4 w-4 shrink-0", art.recvText)} />
        <span
          className={cx(
            "font-display text-xl leading-none font-bold tracking-tight",
            art.recvText,
          )}
        >
          {strategy.visibility}
        </span>
        <span className="text-muted-foreground text-[11px] leading-tight">
          algorithm
          <br />
          placement
        </span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {STRATEGY_VISIBILITY_LADDER.map((lvl, i) => (
          <span
            key={lvl}
            className={cx(
              "h-1.5 flex-1 rounded-full",
              i <= idx ? art.meter : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Box 2 · FAQs — how the membership works, with real numbers ─────────────

function FaqsBox({
  place,
  storedStrategy,
  member,
  capMxn,
}: {
  place: AdminPlace;
  storedStrategy: StrategyId | null;
  member: boolean;
  capMxn: DiscountCapMxn;
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
      subtitle="How membership and strategy work — with real numbers."
    >
      <div className="mt-4 flex flex-col gap-2">
        <Faq q="What does a Premium guest actually get?" defaultOpen>
          <PremiumExamples place={place} storedStrategy={storedStrategy} />
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

        <Faq q="Can I switch strategies?">
          <p>
            Yes — free, anytime, while your membership is active. Strategy is
            the discount posture you promise guests; switching only changes your
            rates. New tickets pick up the new rates; open tickets keep what
            they were created with.
          </p>
        </Faq>

        <Faq q="What is Zero for members?">
          <p>
            Zero pauses discounts — your membership stays active, activation
            state and strikes carry on, but the promo lane closes and visibility
            drops to Low. Cancelling membership is a separate action in the
            Membership box.
          </p>
        </Faq>

        <Faq q="How does visibility work?">
          <p>
            The ranking algorithm reads a stronger discount as a stronger card:
            Zero sits at Low, Conservative at Mid, Aggressive at High.
            Visibility is never a separate knob you can buy — it rises with
            what you give.
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

        <Faq q="How do I cancel membership?">
          <p>
            Use Drop membership in the Membership box — it clears your plan and
            rates.{" "}
            {member
              ? "You are currently a member."
              : "You are not currently a member."}
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
      </div>
    </SectionCard>
  );
}

// Native details/summary accordion item — no state, keyboard-accessible.
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

// The Premium-guest worked examples (FAQ #1) — computed from the place's LIVE
// rate columns, so custom or legacy rates preview exactly what the bill EF
// would apply today.
function PremiumExamples({
  place,
  storedStrategy,
}: {
  place: AdminPlace;
  storedStrategy: StrategyId | null;
}) {
  const hasPromo =
    place.welcome_premium_rate != null || place.premium_rate != null;
  const strategy = storedStrategy ? STRATEGY_BY_ID[storedStrategy] : null;
  const cap = place.monthly_promo_cap ?? DEFAULT_DISCOUNT_CAP_MXN;

  if (!hasPromo) {
    return (
      <div className="border-border/60 bg-muted/20 rounded-xl border border-dashed px-4 py-4 text-center">
        <p className="text-muted-foreground text-[12px] leading-snug">
          No promos right now — Premium guests see this place in the catalog
          with no discount card. Pick a strategy above to preview the deal.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-foreground/80">
          The current rates worked on a sample{" "}
          {formatMoney(EXAMPLE_BILL_MXN, place.currency)} ticket:
        </p>
        <span className="bg-muted text-foreground/70 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
          {strategy && strategy.id !== ZERO_STRATEGY_ID
            ? `${strategy.emoji} ${strategy.name}`
            : "Custom rates"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
        better deal. They are what the membership buys.
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
  currency: string | null;
}) {
  // The discount only touches the first `cap` of the ticket.
  const base = Math.min(EXAMPLE_BILL_MXN, cap);
  const saves =
    premiumRate == null ? 0 : Math.round((base * premiumRate) / 100);
  const pays = EXAMPLE_BILL_MXN - saves;
  const freeSaves = freeRate == null ? 0 : Math.round((base * freeRate) / 100);

  return (
    <div className="border-border/60 rounded-xl border bg-violet-500/[0.03] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          {visit}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-600">
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
            <span className="text-2xl leading-none font-bold text-violet-600 tabular-nums">
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
    <div className="border-border/60 mt-4 rounded-xl border p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-foreground/90 text-[12px] font-semibold">
            Discount cap
          </p>
          <p className="text-muted-foreground text-[11px] leading-snug">
            Every discount applies to the first N pesos of the bill — separate
            from strategy.
          </p>
        </div>
        {pending && (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {DISCOUNT_CAPS_MXN.map((option) => {
          const active = cap === option;
          return (
            <button
              key={option}
              type="button"
              disabled={pending}
              onClick={() => onSelect(option)}
              aria-pressed={active}
              className={
                active
                  ? "bg-foreground text-background inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-bold tabular-nums transition disabled:opacity-50"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-9 items-center rounded-lg border px-3.5 text-[13px] font-semibold tabular-nums transition disabled:opacity-50"
              }
            >
              <Coins className="mr-1.5 h-3.5 w-3.5" />
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
