import type { ReactNode } from "react";
import { TrendingUp, type LucideIcon } from "lucide-react";
import {
  STRATEGY_VISIBILITY_LADDER,
  type Strategy,
} from "@/lib/business/strategies";
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

// The 2x2 discount matrix — Welcome/Returning x Standard/Premium. Pato-sanctioned
// per-card matrix (MESITA-590); rates live in HTML text, never in the artwork.
export function RateMatrix({ rates }: { rates: Strategy["rates"] }) {
  const cell = (v: number | null) => (v == null ? "—" : `${v}%`);
  return (
    <div className="border-border grid grid-cols-[auto_1fr_1fr] overflow-hidden rounded-lg border text-[11px]">
      <span className="bg-muted/40 px-2.5 py-1.5" aria-hidden />
      <span className="text-muted-foreground bg-muted/40 px-2.5 py-1.5 text-center font-semibold">
        Standard
      </span>
      <span className="bg-tier-premium/10 text-tier-premium px-2.5 py-1.5 text-center font-semibold">
        Premium
      </span>

      <span className="text-muted-foreground border-border border-t px-2.5 py-1.5 font-medium">
        Welcome
      </span>
      <span className="text-foreground/80 border-border border-t px-2.5 py-1.5 text-center font-bold tabular-nums">
        {cell(rates.welcome_free_rate)}
      </span>
      <span className="border-border bg-tier-premium/[0.06] text-tier-premium border-t px-2.5 py-1.5 text-center font-bold tabular-nums">
        {cell(rates.welcome_premium_rate)}
      </span>

      <span className="text-muted-foreground border-border border-t px-2.5 py-1.5 font-medium">
        Returning
      </span>
      <span className="text-foreground/80 border-border border-t px-2.5 py-1.5 text-center font-bold tabular-nums">
        {cell(rates.free_rate)}
      </span>
      <span className="border-border bg-tier-premium/[0.06] text-tier-premium border-t px-2.5 py-1.5 text-center font-bold tabular-nums">
        {cell(rates.premium_rate)}
      </span>
    </div>
  );
}

// The "You receive" reward — the payoff, made the card's second visual anchor
// (MESITA-592): the placement level big in the strategy's own accent + a
// filled ladder, so what the membership BUYS reads louder than the mechanics.
export function PlacementReward({
  strategy,
  art,
}: {
  strategy: Strategy;
  art: CardArt;
}) {
  const idx = STRATEGY_VISIBILITY_LADDER.indexOf(strategy.visibility);
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3",
        art.recvBg,
        art.recvBorder,
      )}
    >
      <div className="flex items-center gap-2">
        <TrendingUp className={cn("h-4 w-4 shrink-0", art.recvText)} />
        <span
          className={cn(
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
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i <= idx ? art.meter : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export type MembershipPillState =
  | "not_member"
  | "pending"
  | "live"
  | "paused"
  | "forfeited";

export function membershipPillState(place: {
  plan: string;
  membership_forfeited_at?: string | null;
  membership_live_at?: string | null;
  promo_paused_until?: string | null;
}): MembershipPillState {
  if (place.membership_forfeited_at) return "forfeited";
  if (place.plan === "free") return "not_member";
  if (
    place.promo_paused_until &&
    new Date(place.promo_paused_until).getTime() > Date.now()
  ) {
    return "paused";
  }
  if (place.membership_live_at) return "live";
  return "pending";
}

export function MembershipStatusPill({
  state,
}: {
  state: MembershipPillState;
}) {
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
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase",
        state === "forfeited" && "bg-destructive/10 text-destructive",
        state === "paused" && "bg-amber-500/12 text-amber-800",
        liveish && "bg-emerald-500/12 text-emerald-700",
        state === "not_member" && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
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

/** @deprecated use MembershipStatusPill */
export function StatusPill({ subscribed }: { subscribed: boolean }) {
  return <MembershipStatusPill state={subscribed ? "live" : "not_member"} />;
}

export function SubHeading({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <Icon className="text-muted-foreground h-3.5 w-3.5" />
      <span className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
        {children}
      </span>
    </div>
  );
}

export function ActivationStep({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="border-border bg-card flex items-center gap-2.5 rounded-xl border px-3 py-2">
      <span className="bg-muted/70 text-foreground/70 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-foreground/80 text-[12px] leading-snug">
        {children}
      </span>
    </div>
  );
}
