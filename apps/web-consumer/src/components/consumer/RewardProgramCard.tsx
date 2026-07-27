"use client";

import type { LucideIcon } from "lucide-react";
import {
  Crown,
  DoorOpen,
  Instagram,
  Magnet,
  Star,
  User,
} from "lucide-react";

import { useConsumerClass } from "@/lib/class-context";
import { classProperLabel, isElevatedClass } from "@/lib/consumer-data";
import {
  PEAK_STRATEGY,
  REWARD_SEGMENTS,
  baseRateForClass,
  peakRateForClass,
  segmentKeyForClass,
  type RewardSegment,
  type RewardSegmentKey,
} from "@/lib/reward-segments";
import { cn } from "@/lib/utils";

// The Rewards program card: a "max % for you" banner over the six-segment
// ladder (Promos v5, MESITA-723). It answers the two questions the guest has on
// the Rewards page — "how much can I get?" (the banner) and "why / how do I get
// more?" (the ladder, with the guest's own rung marked "You"). Program
// education, not a per-place quote: the exact % at a given place shows on that
// place's detail. Best-of means the guest is always paid their single best rung.

const SEGMENT_ICON: Record<RewardSegmentKey, LucideIcon> = {
  standard: User,
  magnetic: Magnet,
  premium: Crown,
  story: Instagram,
  welcome: DoorOpen,
  review: Star,
};

// Tint per ontology: class rungs read brand-pink / premium-violet, the earned
// action + visit rungs read secondary, so "who you are" vs "what you do" is
// legible at a glance.
function rungTint(seg: RewardSegment, mine: boolean): string {
  if (mine) return "bg-white/20 text-white";
  if (seg.key === "premium" || seg.key === "magnetic")
    return "bg-tier-premium/10 text-premium";
  if (seg.kind === "class") return "bg-primary/10 text-primary";
  return "bg-secondary/10 text-secondary";
}

export function RewardProgramCard() {
  const { key: classKey } = useConsumerClass();
  const mineKey = segmentKeyForClass(classKey);
  const peak = peakRateForClass(classKey);
  const base = baseRateForClass(classKey);
  const isElevated = isElevatedClass(classKey);

  // Banner copy — the ceiling headline, then a class-aware line so an elevated
  // class's higher base still reads even though the ceiling (a Google review)
  // is universal.
  const bannerSub = isElevated
    ? `${classProperLabel(classKey)} gives you a ${base}% base — climb to ${peak}% with a Google review at the table.`
    : `You start at ${base}% as Standard — go up to ${peak}% with Premium, stories and reviews.`;

  return (
    <section className="border-border bg-card overflow-hidden rounded-[28px] border">
      {/* Banner — "the max amount of reward you can get". */}
      <div className="bg-pink-gradient shadow-glow px-5 pt-5 pb-6 text-white">
        <p className="text-[10px] font-bold tracking-[0.14em] text-white/80 uppercase">
          Your max reward
        </p>
        <p className="font-display mt-1 flex items-baseline gap-1.5 text-[40px] leading-none font-bold tracking-tight">
          Up to {peak}%
          <span className="text-base font-semibold text-white/85">off for you</span>
        </p>
        <p className="mt-2 max-w-[34ch] text-[12.5px] leading-snug text-white/90">
          {bannerSub}
        </p>
      </div>

      {/* Ladder — the six rungs, worst→best, the guest's own rung highlighted. */}
      <div className="flex flex-col gap-1.5 px-3.5 pt-4 pb-4">
        <div className="flex items-baseline justify-between px-1 pb-1">
          <h3 className="text-foreground text-sm font-bold tracking-tight">
            Reward tiers
          </h3>
          <span className="text-muted-foreground text-[11px]">
            You keep your best one
          </span>
        </div>

        {REWARD_SEGMENTS.map((seg) => (
          <RungRow key={seg.key} seg={seg} mine={seg.key === mineKey} />
        ))}

        <p className="text-muted-foreground/80 mt-2 px-1 text-[11px] leading-snug">
          Tiers stack up to the best one you qualify for — never added together.
          Magnetic is invite-only. The exact % at each place shows on its page.
        </p>
      </div>
    </section>
  );
}

function RungRow({ seg, mine }: { seg: RewardSegment; mine: boolean }) {
  const Icon = SEGMENT_ICON[seg.key];
  const peak = seg.rates[PEAK_STRATEGY];
  const magneticLocked = seg.key === "magnetic" && !mine;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition",
        mine
          ? "bg-pink-gradient shadow-glow text-white"
          : "bg-muted/40 ring-border/50 ring-1 ring-inset",
        magneticLocked && "opacity-60",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          rungTint(seg, mine),
        )}
      >
        <Icon
          className="size-[18px]"
          strokeWidth={2}
          {...(seg.key === "premium" || seg.key === "review"
            ? { fill: "currentColor" as const }
            : {})}
        />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "flex items-center gap-1.5 text-[13.5px] leading-tight font-bold",
            mine ? "text-white" : "text-foreground",
          )}
        >
          <span className="truncate">{seg.name}</span>
          {mine ? (
            <span className="shrink-0 rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-extrabold tracking-widest uppercase">
              You
            </span>
          ) : magneticLocked ? (
            <span className="text-premium bg-tier-premium/10 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase">
              Invite only
            </span>
          ) : null}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-[11.5px] leading-snug",
            mine ? "text-white/85" : "text-muted-foreground",
          )}
        >
          {seg.blurb}
        </p>
      </div>

      <span
        className={cn(
          "font-display shrink-0 text-[17px] leading-none font-extrabold tabular-nums",
          mine ? "text-white" : "text-foreground/80",
        )}
      >
        {peak}%
      </span>
    </div>
  );
}
