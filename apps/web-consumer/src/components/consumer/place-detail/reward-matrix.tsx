import type { LucideIcon } from "lucide-react";
import {
  DoorOpen,
  Instagram,
  Star,
  Store,
  UtensilsCrossed,
} from "lucide-react";

import {
  CLASS_FLOOR,
  CLASS_ICONS,
  CLASS_ORDER,
  PREMIUM_PLAN_ICON,
  PREMIUM_PLAN_PRICE_MXN,
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
            "type-body flex items-center gap-1.5 truncate leading-tight font-bold",
            muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {label}
          {mine ? (
            <span className="bg-primary text-primary-foreground type-meta shrink-0 rounded-full px-1.5 py-0.5 font-extrabold tracking-widest uppercase">
              You
            </span>
          ) : null}
        </span>
        {hint ? (
          <span className="text-muted-foreground type-label mt-0.5 block truncate">
            {hint}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "font-display shrink-0 text-sm leading-none font-extrabold tabular-nums",
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

// Which LEGACY segment carries each v2 class's free-plan rate. Used only when
// the quote has no v11 `breakdown` (best-of fallback / stale EF).
const LADDER_SOURCE: Record<ClassKey, LegacyClassKey | null> = {
  bronze: "standard",
  silver: "influencer",
  gold: null,
  diamond: "aura",
};

function standingForClass(quote: RewardQuote, key: ClassKey): number | null {
  if (quote.breakdown) {
    return quote.breakdown.automatic + quote.breakdown.classes[key];
  }
  const source = LADDER_SOURCE[key];
  if (!source || !quote.ladder) return null;
  return quote.ladder[source] ?? 0;
}

function classAdder(quote: RewardQuote, key: ClassKey): number | null {
  if (quote.breakdown) return quote.breakdown.classes[key];
  const standing = standingForClass(quote, key);
  const floor = standingForClass(quote, CLASS_FLOOR.id);
  if (standing == null || floor == null) return standing;
  return standing - floor;
}

function premiumUplift(quote: RewardQuote): number | null {
  if (quote.breakdown) return quote.breakdown.planUplift;
  if (quote.ladder?.premium == null) return null;
  const freeFloor = quote.ladder.standard;
  if (freeFloor == null) return quote.ladder.premium;
  return quote.ladder.premium - freeFloor;
}

// The bronze·free floor — named as its own rung so Base is never folded into
// a class total on a v11 quote. Legacy quotes have no decomposition; skip.
export function BaseRow({ quote }: { quote: RewardQuote }) {
  if (!quote.breakdown) return null;
  return (
    <Row
      icon={Store}
      label="Base"
      hint="Standing offer — every guest, every visit"
      value={quote.breakdown.automatic}
    />
  );
}

// Class adders on v11 (Base is a separate row). Standing rates on the legacy
// ladder, where Gold still cannot be quoted.
export function ClassLadder({
  quote,
  classKey,
}: {
  quote: RewardQuote;
  classKey: ClassKey;
}) {
  if (!quote.breakdown && !quote.ladder) return null;
  const additive = Boolean(quote.breakdown);
  return (
    <div className="flex flex-col gap-1.5">
      {CLASS_ORDER.map((key) => {
        const value = additive
          ? classAdder(quote, key)
          : standingForClass(quote, key);
        return (
          <Row
            key={key}
            icon={CLASS_ICONS[key]}
            label={classProperLabel(key)}
            hint={value == null ? "Not priced here yet" : undefined}
            value={value}
            plus={additive && (value ?? 0) > 0}
            mine={key === classKey}
            muted={value == null || (additive && value === 0 && key !== classKey)}
          />
        );
      })}
    </div>
  );
}

// Plan is its own axis: Free is the floor (no adder), Premium is the paid
// uplift from `breakdown.planUplift`. Never print `ladder.premium` as that
// adder — that cell is a standing bronze·premium rate, not a plan bonus.
export function PlanRow({
  quote,
  plan,
}: {
  quote: RewardQuote;
  plan: PlanKey;
}) {
  const uplift = premiumUplift(quote);
  if (uplift == null && !quote.breakdown) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Row
        icon={Star}
        label="Free"
        hint="No subscription"
        value={0}
        mine={plan === "free"}
        muted={plan !== "free"}
      />
      <Row
        icon={PREMIUM_PLAN_ICON}
        label="Premium"
        hint={`$${PREMIUM_PLAN_PRICE_MXN} MXN / mo`}
        value={uplift ?? 0}
        plus={(uplift ?? 0) > 0}
        mine={plan === "premium"}
        muted={plan !== "premium"}
      />
    </div>
  );
}

// Every bonus the engine prices, in the same order as admin Tiers: Welcome,
// Instagram Story, Google Review, Mesita Review. Zero is listed and faded —
// hiding a rung makes the rate sheet lie about what exists.
export function BonusList({ quote }: { quote: RewardQuote }) {
  const b = quote.bonuses;
  const rows = [
    {
      icon: DoorOpen,
      label: "Welcome",
      hint: quote.isFirstVisit
        ? "Automatic on your first visit here"
        : "First visit only",
      value: b.welcome,
      muted: b.welcome === 0,
    },
    {
      icon: Instagram,
      label: "Instagram Story",
      hint: quote.storyEligible
        ? "Tag the place from your connected Instagram"
        : "Connect Instagram on Me to unlock",
      value: b.story,
      muted: b.story === 0 || !quote.storyEligible,
    },
    {
      icon: Star,
      label: "Google Review",
      hint: "At the table, once per place",
      value: b.google,
      muted: b.google === 0,
    },
    {
      icon: UtensilsCrossed,
      label: "Mesita Review",
      hint: "Rate it in the app — feeds its rating",
      value: b.mesita,
      muted: b.mesita === 0,
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
        <span className="text-foreground type-body font-bold">
          {quote.additive ? "Everything stacked" : "Your best single rung"}
        </span>
        <span className="font-display text-primary text-xl leading-none font-extrabold tabular-nums">
          {total}%
        </span>
      </div>
      <p className="text-muted-foreground type-label leading-snug">
        {quote.additive
          ? "Your class plus every bonus you complete, added together"
          : "Bonuses don't stack here — you keep the single best one"}
        {capLabel ? ` · applied to your first ${capLabel}` : ""}
      </p>
    </div>
  );
}
