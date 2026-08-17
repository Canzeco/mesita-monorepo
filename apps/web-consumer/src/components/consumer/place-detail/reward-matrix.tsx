import type { LucideIcon } from "lucide-react";
import { DoorOpen, Instagram, Star, UtensilsCrossed } from "lucide-react";

import {
  CLASS_ICONS,
  CLASS_ORDER,
  PREMIUM_PLAN_ICON,
  classProperLabel,
  type ClassKey,
  type LegacyClassKey,
  type PlanKey,
} from "@/lib/consumer-data";
import type { RewardQuote } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

// ── The rate sheet (v8, MESITA-1068) ────────────────────────────────────
//
// Pato, live 2026-08-17: "simply mention all the tiers for different
// segments. and the total and the cap. not buttons there."
//
// This replaces v7's single-row "your rewards here" + four-step tutorial.
// v7 showed the guest ONLY their own row on purpose (MESITA-861 killed the
// Standard-vs-Premium comparison); Pato has reversed that — the whole ladder
// is back, because a rate sheet that hides the rungs above you can't tell you
// what a class is worth, and the classes are the product.
//
// EVERY number here comes from `quote` — the live engine (MESITA-1017). None
// of it is reconstructed from `reward-segments.ts`, which is program
// education only.

function Row({
  icon: Icon,
  label,
  hint,
  value,
  plus = false,
  mine = false,
  muted = false,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  /** null renders ★ — an action this place hasn't priced. */
  value: number | null;
  plus?: boolean;
  mine?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-2.5 py-2",
        mine ? "bg-primary/8 ring-primary/15 ring-1" : "bg-muted/45",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          mine
            ? "bg-primary/12 text-primary"
            : muted
              ? "bg-muted text-muted-foreground"
              : "bg-secondary/10 text-secondary",
        )}
      >
        <Icon className="size-4" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "flex items-center gap-1.5 truncate text-[12.5px] leading-tight font-bold",
            muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {label}
          {mine ? (
            <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-widest uppercase">
              You
            </span>
          ) : null}
        </span>
        {hint ? (
          <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">
            {hint}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "font-display shrink-0 text-[15px] leading-none font-extrabold tabular-nums",
          muted ? "text-muted-foreground" : "text-foreground/85",
        )}
      >
        {value == null ? "★" : `${plus && value > 0 ? "+" : ""}${value}%`}
      </span>
    </div>
  );
}

export function RateSheetSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-muted h-11 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

// Which LEGACY segment carries each v2 class's free-plan rate. This is the
// display half of the bridge (MESITA-1079): the engine reports the ladder
// under the four legacy keys, so Bronze reads `standard`, Silver reads
// `influencer` and Diamond reads `aura`.
//
// GOLD IS `null` AND THAT IS THE TRUTH, not a gap to paper over: no legacy key
// resolves to Gold, so the engine has never priced it and nothing grants it
// today (MESITA-1076). The row renders ★, which is the same thing this sheet
// already shows for an action a place hasn't priced.
const LADDER_SOURCE: Record<ClassKey, LegacyClassKey | null> = {
  bronze: "standard",
  silver: "influencer",
  gold: null,
  diamond: "aura",
};

// Every class's standing rate at THIS place, in rank order, the guest's own
// marked. Renders nothing when the engine didn't send a ladder — better a
// missing section than one rebuilt from a client-side table the till has
// never seen.
export function ClassLadder({
  quote,
  classKey,
}: {
  quote: RewardQuote;
  classKey: ClassKey;
}) {
  const ladder = quote.ladder;
  if (!ladder) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {CLASS_ORDER.map((key) => {
        const source = LADDER_SOURCE[key];
        return (
          <Row
            key={key}
            icon={CLASS_ICONS[key]}
            label={classProperLabel(key)}
            hint={key === "gold" ? "Not priced here yet" : undefined}
            value={source ? (ladder[source] ?? 0) : null}
            mine={key === classKey}
            muted={source == null}
          />
        );
      })}
    </div>
  );
}

// The OTHER axis, and the reason this sheet now has two sections. Premium used
// to sit in the ladder above as a rung between Influencer and Aura, which read
// as "pay to outrank someone with reach" — the exact merge Classes v2 removes.
//
// The number is the `bronze·premium` cell and is labelled as such. It is the
// only premium cell the payload carries, and deriving the others (silver on
// Premium, diamond on Premium) would mean client-side arithmetic over rates
// the till has never quoted — precisely the drift MESITA-1017 fixed.
export function PlanRow({ quote, plan }: { quote: RewardQuote; plan: PlanKey }) {
  const value = quote.ladder?.premium;
  if (value == null) return null;
  return (
    <Row
      icon={PREMIUM_PLAN_ICON}
      label="Premium"
      hint="On Bronze · $50 MXN / mo"
      value={value}
      mine={plan === "premium"}
    />
  );
}

// The actions, priced. Welcome is a state of the visit rather than something
// the guest picks, so it only appears while it's actually live — advertising
// a spent welcome as "+0%" is worse than not showing it at all.
export function BonusList({ quote }: { quote: RewardQuote }) {
  const b = quote.bonuses;
  const rows = [
    ...(quote.isFirstVisit && b.welcome > 0
      ? [
          {
            icon: DoorOpen,
            label: "Welcome visit",
            hint: "Automatic on your first visit here",
            value: b.welcome,
          },
        ]
      : []),
    {
      icon: UtensilsCrossed,
      label: "Mesita review",
      hint: "Rate it in the app — feeds its rating",
      value: b.mesita > 0 ? b.mesita : null,
    },
    {
      icon: Instagram,
      label: "Instagram story",
      hint: quote.storyEligible
        ? "Tag the place from your connected Instagram"
        : "Connect Instagram on Me to unlock",
      value: b.story > 0 ? b.story : null,
      muted: !quote.storyEligible,
    },
    {
      icon: Star,
      label: "Google review",
      hint: "At the table, once per place",
      value: b.google > 0 ? b.google : null,
    },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <Row key={r.label} {...r} plus />
      ))}
    </div>
  );
}

// The total and the cap — the two numbers the guest actually acts on.
//
// `additive` is load-bearing, not decoration: when the engine is still on the
// legacy best-of fallback the components DON'T sum, and a total that added
// them would over-promise. That is the one direction of error a discount quote
// must never make, so the label and the arithmetic both switch.
export function RewardTotal({
  quote,
  total,
  capLabel,
}: {
  quote: RewardQuote;
  total: number;
  capLabel: string | null;
}) {
  return (
    <div className="border-primary/20 bg-primary/8 flex flex-col gap-1 rounded-xl border px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-foreground text-[12.5px] font-bold">
          {quote.additive ? "Everything stacked" : "Your best single rung"}
        </span>
        <span className="font-display text-primary text-xl leading-none font-extrabold tabular-nums">
          {total}%
        </span>
      </div>
      <p className="text-muted-foreground text-[11px] leading-snug">
        {quote.additive
          ? "Your class plus every bonus you complete, added together"
          : "Bonuses don't stack here — you keep the single best one"}
        {capLabel ? ` · applied to your first ${capLabel}` : ""}
      </p>
    </div>
  );
}
