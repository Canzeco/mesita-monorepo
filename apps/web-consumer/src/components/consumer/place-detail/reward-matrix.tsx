import type { LucideIcon } from "lucide-react";
import { DoorOpen, Instagram, Star, User, UtensilsCrossed } from "lucide-react";

import { classProperLabel } from "@/lib/consumer-data";
import type { ClassKey } from "@/lib/consumer-data";
import type { PlaceStrategy } from "@/lib/promo-rates";
import {
  REWARD_SEGMENT_BY_KEY,
  segmentKeyForClass,
} from "@/lib/reward-segments";
import { cn } from "@/lib/utils";

// One numbered step in the "How it works" sequence. The badge carries the
// step number (or a ✓ once the step is already satisfied — e.g. "Pick place"
// on the place's own page); the tinted icon circle reads premium-violet for
// the Instagram-only step and brand-pink otherwise.
export function RewardStep({
  n,
  icon: Icon,
  title,
  body,
  accent,
  done = false,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  body: string;
  accent?: boolean;
  done?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          accent
            ? "bg-tier-premium/10 text-premium"
            : "bg-secondary/10 text-secondary",
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        <span
          className={cn(
            "text-background absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
            done ? "bg-emerald-500 text-white" : "bg-foreground",
          )}
        >
          {done ? "✓" : n}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-[13px] leading-tight font-semibold">
          {title}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
          {body}
        </p>
      </div>
    </li>
  );
}

// ── Your rewards at THIS place (v7, MESITA-861) ─────────────────────────
//
// The guest's own row of the big Strategy × Class table, action by action,
// at the place's strategy. Replaces the old Standard-vs-Premium comparison
// matrix: the guest sees what THEY can get here, never class arithmetic —
// the same privacy direction as the ribbon rule (MESITA-860).

type Row = {
  icon: LucideIcon;
  label: string;
  hint: string;
  /** null = show ★ (the Mesita review, unpriced today); number = percent. */
  value: number | null;
  mine?: boolean;
};

export function YourRewardsHere({
  strategy,
  classKey,
}: {
  strategy: PlaceStrategy;
  classKey: ClassKey;
}) {
  const mine = REWARD_SEGMENT_BY_KEY[segmentKeyForClass(classKey)];

  const rows: Row[] = [
    {
      icon: User,
      label: `${classProperLabel(classKey)} — always on`,
      hint: "Your standing discount, every visit",
      value: mine.rates[strategy],
      mine: true,
    },
    {
      icon: UtensilsCrossed,
      label: "Mesita review",
      hint: "Rate it in the app — feeds its rating",
      value: null,
    },
    {
      icon: Instagram,
      label: "Instagram story",
      hint: "Tag the place — any connected Instagram",
      value: REWARD_SEGMENT_BY_KEY.story.rates[strategy],
    },
    {
      icon: DoorOpen,
      label: "Welcome visit",
      hint: "Automatic on your first visit here",
      value: REWARD_SEGMENT_BY_KEY.welcome.rates[strategy],
    },
    {
      icon: Star,
      label: "Google review",
      hint: "At the table, once per place",
      value: REWARD_SEGMENT_BY_KEY.review.rates[strategy],
    },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div
          key={r.label}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-2.5 py-2",
            r.mine ? "bg-primary/8" : "bg-muted/45",
          )}
        >
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg",
              r.mine
                ? "bg-primary/12 text-primary"
                : "bg-secondary/10 text-secondary",
            )}
          >
            <r.icon className="size-4" strokeWidth={2.25} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground flex items-center gap-1.5 truncate text-[12.5px] leading-tight font-bold">
              {r.label}
              {r.mine ? (
                <span className="bg-primary/12 text-primary shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-widest uppercase">
                  You
                </span>
              ) : null}
            </span>
            <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">
              {r.hint}
            </span>
          </span>
          <span className="font-display text-foreground/85 shrink-0 text-[15px] leading-none font-extrabold tabular-nums">
            {r.value == null ? "★" : `${r.value}%`}
          </span>
        </div>
      ))}
      <p className="text-muted-foreground/80 mt-1 px-1 text-[10.5px] leading-snug">
        You always keep your single best one — never added together.
      </p>
    </div>
  );
}
