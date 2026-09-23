import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  DoorOpen,
  Gem,
  Instagram,
  Star,
  Store,
  UtensilsCrossed,
} from "lucide-react";

import type { ClassKey } from "@/lib/consumer-data";
import {
  BASE_RATE_HINT,
  BASE_RATE_LABEL,
  DIAMOND,
  DIAMOND_RATE_HINT,
} from "@/lib/consumer-identity";
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
// TWO IDENTITY ROWS SINCE MESITA-2044 (Pato: "there are no classes, either
// you are diamond or you are not… Diamond List"). The ladder is Base — every
// guest — and Diamond's adder on top. No Bronze/Silver/Gold rows.
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
  onTap,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  /** null renders ★ — an action this place hasn't priced. */
  value: number | null;
  plus?: boolean;
  mine?: boolean;
  muted?: boolean;
  /** Renders the row as a button — only the sellable Premium rung uses this
   *  (MESITA-1620). */
  onTap?: () => void;
}) {
  const Comp = onTap ? "button" : "div";
  return (
    <Comp
      type={onTap ? "button" : undefined}
      onClick={onTap}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left",
        mine ? "bg-primary/8 ring-primary/15 ring-1" : "bg-muted/45",
        onTap && "transition active:scale-[0.99]",
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
      {onTap ? (
        <ChevronRight
          className="text-muted-foreground size-4 shrink-0"
          strokeWidth={2.25}
        />
      ) : null}
    </Comp>
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

/** The Base: what every guest gets here. v12 decomposes it as `automatic`
 *  (the `bronze` row's adder is 0 by construction); the legacy best-of ladder
 *  quotes it as the `standard` standing rate. */
function baseRate(quote: RewardQuote): number | null {
  if (quote.breakdown) {
    return quote.breakdown.automatic + (quote.breakdown.classes.bronze ?? 0);
  }
  return quote.ladder?.standard ?? null;
}

/** Diamond's ADDER over the Base — never a standing total, so the
 *  row reads "+N%" beside Base's N%. Legacy ladders carry no decomposition, so
 *  the adder is `aura` (Diamond's legacy key) minus `standard`. */
function diamondAdder(quote: RewardQuote): number | null {
  if (quote.breakdown) {
    const b = quote.breakdown;
    return (b.classes.diamond ?? 0) - (b.classes.bronze ?? 0);
  }
  const standing = quote.ladder?.aura;
  const base = quote.ladder?.standard;
  if (standing == null || base == null) return null;
  return Math.max(0, standing - base);
}

// THE TWO IDENTITY ROWS (MESITA-2044). Base, then Diamond as an
// adder; the guest's own row carries the You marker. Was `BaseRow` + a
// four-metal `ClassLadder` — the Base row now lives here, so a caller can
// never render it twice or forget it.
export function ClassLadder({
  quote,
  classKey,
}: {
  quote: RewardQuote;
  classKey: ClassKey | string;
}) {
  if (!quote.breakdown && !quote.ladder) return null;
  const onList = classKey === "diamond";
  const base = baseRate(quote);
  const adder = diamondAdder(quote);
  return (
    <div className="flex flex-col gap-1.5">
      <Row
        icon={Store}
        label={BASE_RATE_LABEL}
        hint={BASE_RATE_HINT}
        value={base}
        mine={!onList}
        muted={base == null}
      />
      <Row
        icon={Gem}
        label={DIAMOND}
        hint={DIAMOND_RATE_HINT}
        value={adder}
        plus
        mine={onList}
        muted={adder == null || (adder === 0 && !onList)}
      />
    </div>
  );
}

// THE PLAN IS NOT A RUNG ANY MORE (MESITA-1705). A Free/Premium pair sat here
// and the Premium row was the one button on this rate sheet — the
// highest-intent Premium surface in the app, because the guest reading it
// already had a place, a bill and a concrete number (MESITA-1620).
//
// It is gone because the number behind it is gone: the plan no longer moves a
// rate, so the row could only ever have shown +0%, and a sell that promises
// nothing is worse than no sell. Premium is still sold — on reservations,
// recommendations and subscriber terms on Credits — from Me › Plan, which is
// now the only place that pitches it.
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
          {quote.additive ? "Everything stacked" : "Your best single reward"}
        </span>
        <span className="font-display text-primary text-xl leading-none font-extrabold tabular-nums">
          {total}%
        </span>
      </div>
      <p className="text-muted-foreground type-body leading-snug">
        {quote.additive
          ? "Your rate plus every bonus you complete, added together"
          : "Bonuses don't stack here — you keep the single best one"}
        {capLabel ? ` · applied to your first ${capLabel}` : ""}
      </p>
    </div>
  );
}
