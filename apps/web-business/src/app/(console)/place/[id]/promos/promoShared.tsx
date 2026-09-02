import type { ReactNode } from "react";
import { type Strategy } from "@/lib/business/strategies";
import {
  ACTION_META,
  CLASS_KEYS,
  CLASS_META,
  METER_SEGMENTS,
  PLAN_KEYS,
  giveLevel,
  premiumUplift,
  totalFor,
  visibilityDots,
  type ActionKey,
  type PromosConfig,
  type StrategyKey,
} from "@/lib/business/promos";
import { cn } from "@/lib/utils";
import type { CardArt } from "./promoConstants";

export function ModalLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
      {children}
    </span>
  );
}

// One numbered step in the modal's "How it works" flow.
export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: ReactNode;
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

// Every rate this posture pays — class rows at Free (the floor a place is
// guaranteed to pay). Premium is private, so it is one uplift line, not a
// second guest column. Columns follow the guest rung order.
const MATRIX_ACTIONS: readonly ActionKey[] = [
  "standing",
  "welcome",
  "story",
  "review",
  "mesita_review",
];

export function RateMatrix({
  cfg,
  strategy,
}: {
  cfg: PromosConfig;
  strategy: StrategyKey;
}) {
  const cell = (v: number) => (v > 0 ? `${v}%` : "—");
  const shortAction: Record<ActionKey, string> = {
    standing: "Base",
    welcome: "Welcome",
    story: "Story",
    review: "Google",
    mesita_review: "Mesita",
  };
  const uplifts = CLASS_KEYS.map((cls) => premiumUplift(cfg, strategy, cls));
  const sameUplift = uplifts.every((u) => u === uplifts[0]);
  return (
    <div className="flex flex-col gap-1">
      <div className="border-border grid grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))] overflow-hidden rounded-lg border text-[10.5px]">
        <span className="bg-muted/40 px-2 py-1.5" aria-hidden />
        {MATRIX_ACTIONS.map((a) => (
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
              className="text-muted-foreground border-border truncate border-t px-2 py-1.5 font-medium"
              title={CLASS_META[cls].name}
            >
              {CLASS_META[cls].emoji} {CLASS_META[cls].name}
            </span>
            {MATRIX_ACTIONS.map((a) => (
              <span
                key={a}
                className="text-foreground/80 border-border border-t px-1 py-1.5 text-center font-bold tabular-nums"
              >
                {cell(totalFor(cfg, strategy, cls, a, PLAN_KEYS[0]))}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="text-muted-foreground/80 text-[10px] leading-snug">
        {MATRIX_ACTIONS.map(
          (a, i) =>
            `${i > 0 ? " · " : ""}${ACTION_META[a].emoji} ${ACTION_META[a].name}`,
        ).join("")}
        {sameUplift
          ? ` · Premium +${uplifts[0]}%`
          : ` · Premium ${CLASS_KEYS.map((cls, i) => `${CLASS_META[cls].name} +${uplifts[i]}`).join(" / ")}`}
      </p>
    </div>
  );
}

/** Label · value · three-segment rail · one grounding line. */
export function MeterStat({
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
          className={cn(
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
            className={cn(
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

/**
 * The two meters that replaced the table on the card face — give (how much
 * you discount) and get (algorithm placement), on one shared rail. `compact`
 * is the modal's side-by-side variant, which drops the longer notes.
 */
export function StrategyMeters({
  strategy,
  art,
  cfg,
  compact,
}: {
  strategy: Strategy;
  art: CardArt;
  cfg: PromosConfig;
  compact?: boolean;
}) {
  const paid = strategy.id !== "zero";
  const give = giveLevel(cfg, strategy.id);
  const valueClass = paid ? art.accent : "text-muted-foreground";

  return (
    <>
      <MeterStat
        label="You give"
        value={paid ? `~${give.mean}%` : "0%"}
        valueClass={valueClass}
        dots={give.dots}
        meterClass={art.meter}
        note={
          !paid
            ? compact
              ? "No discounts"
              : "Nothing — Zero is free."
            : compact
              ? "Projected avg / bill"
              : `Projected average · 9 in 10 bills land ${give.p10}–${give.p90}%`
        }
      />
      <MeterStat
        label="You get"
        value={compact ? strategy.visibility : `${strategy.visibility} visibility`}
        valueClass={valueClass}
        dots={visibilityDots(strategy.visibility)}
        meterClass={art.meter}
        note={
          compact
            ? "Algorithm placement"
            : "Placement in the discovery algorithm"
        }
      />
    </>
  );
}

export type MembershipPillState =
  | "not_member"
  | "pending"
  | "live"
  | "paused"
  | "forfeited"
  | "review";

export function membershipPillState(place: {
  plan: string;
  plan_forfeited_at?: string | null;
  plan_live_at?: string | null;
  promo_paused_until?: string | null;
  reward_lane_pending_review_at?: string | null;
}): MembershipPillState {
  // Ghost-partner hold (MESITA-1311) outranks everything — same order as
  // assessPromoLane in the EF.
  if (place.reward_lane_pending_review_at) return "review";
  if (place.plan_forfeited_at) return "forfeited";
  if (place.plan === "free") return "not_member";
  if (
    place.promo_paused_until &&
    new Date(place.promo_paused_until).getTime() > Date.now()
  ) {
    return "paused";
  }
  if (place.plan_live_at) return "live";
  return "pending";
}

export function MembershipStatusPill({
  state,
}: {
  state: MembershipPillState;
}) {
  const labels: Record<MembershipPillState, string> = {
    not_member: "Listed",
    pending: "Partner — pending",
    live: "Partner — live",
    paused: "Paused",
    forfeited: "Forfeited",
    review: "Under review",
  };
  const liveish = state === "live" || state === "pending";
  const amber = state === "paused" || state === "review";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase",
        state === "forfeited" && "bg-destructive/10 text-destructive",
        amber && "bg-amber-500/12 text-amber-800",
        liveish && "bg-emerald-500/12 text-emerald-700",
        state === "not_member" && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          state === "forfeited" && "bg-destructive",
          amber && "bg-amber-500",
          liveish && "bg-emerald-500",
          state === "not_member" && "bg-muted-foreground/50",
        )}
      />
      {labels[state]}
    </span>
  );
}
