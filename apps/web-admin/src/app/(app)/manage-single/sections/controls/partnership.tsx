"use client";

import { Check, Loader2, Percent } from "lucide-react";
import { STRATEGY_BY_ID, type StrategyId } from "@/lib/business/strategies";
import { type AdminPlace } from "../../actions";
import { SectionCard } from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";
import {
  describeMembershipStatus,
  lifecycleView,
  type LifecycleStepState,
  type MembershipPillState,
} from "../promo-state";
import {
  cx,
  formatMoney,
  MEMBERSHIP_PRICE_MXN,
  ZERO_STRATEGY_ID,
} from "./shared";

// Partnership box + its lifecycle rail + the status pill. Moved verbatim out
// of PromosSection.tsx on 2026-09-02 (file split, no behaviour change).

// ─── Lifecycle banner — this place's progress on the three Tutorial steps ─
//
// One rail of three markers + ONE detail line for the step you're on. The
// earlier three-column stepper printed all three details at once, which read
// as a wall of 11px next to the boxes that carry the actual controls; every
// rail state has exactly one current-or-blocked step, so a single line says
// the same thing. Live on a paid strategy collapses to a slim strip (the
// teaching job is done; strikes keep it honest). Non-interactive on purpose:
// the actionable controls stay in the Partnership box and strategy cards.
// decision: the banner does NOT repeat the partnership status pill — the
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
      ? "Join with the Stripe mock below."
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


// ─── Box 2 · Partnership ───────────────────────────────────────────────────

export function MembershipBox({
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
    ? null
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

        {nextLine && (
          <p className="text-muted-foreground text-xs leading-snug">
            {nextLine}
          </p>
        )}

        {showJoin && (
          <div className="flex flex-col gap-2">
            <StripeJoinButton
              price={price}
              busy={joinBusy}
              forfeited={forfeited}
              onClick={onJoinClick}
            />
            <p className="text-muted-foreground type-meta leading-snug">
              Mock checkout — no charge.
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
        : "Join Partnership"}
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

