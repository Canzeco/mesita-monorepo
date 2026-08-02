"use client";

// The single education home for the Rewards wallet (MESITA-808, decision 1A):
// how rewards work, the seven-rung ladder, and the member scorecard — all the
// content that used to live as page-level cards (RewardProgramCard banner,
// RewardsTopCards sheet, MyQrCard scorecard) now opens from the context strip.

import type { LucideIcon } from "lucide-react";
import {
  Crown,
  DoorOpen,
  Info,
  Instagram,
  Megaphone,
  Percent,
  Sparkles,
  Star,
  User,
} from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { formatCurrency } from "@/lib/api/profile";
import { useConsumerClass } from "@/lib/class-context";
import type { RewardStats } from "@/lib/hooks/useConsumerPayTickets";
import {
  PEAK_STRATEGY,
  REWARD_SEGMENTS,
  segmentKeyForClass,
  type RewardSegmentKey,
} from "@/lib/reward-segments";
import { cn } from "@/lib/utils";

const SEGMENT_ICON: Record<RewardSegmentKey, LucideIcon> = {
  standard: User,
  premium: Crown,
  influencer: Megaphone,
  aura: Sparkles,
  story: Instagram,
  welcome: DoorOpen,
  review: Star,
};

export function HowItWorksSheet({
  open,
  onClose,
  stats,
}: {
  open: boolean;
  onClose: () => void;
  stats?: RewardStats;
}) {
  const { key: classKey } = useConsumerClass();
  const mine = segmentKeyForClass(classKey);

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="How rewards work">
      <div className="space-y-4 px-5 pt-4 pb-8">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-xl">
            <Info className="size-[18px]" />
          </span>
          <h2 className="text-foreground text-lg font-bold tracking-tight">
            How rewards work
          </h2>
        </div>

        <div className="flex items-start gap-3">
          <span className="bg-secondary/12 text-secondary grid size-9 shrink-0 place-items-center rounded-xl">
            <Percent className="size-[18px]" strokeWidth={2.25} />
          </span>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            <span className="text-foreground font-semibold">
              Instant discounts.
            </span>{" "}
            Start a ticket, show its QR at the table — the discount comes
            straight off the bill. Mesita never holds your money.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <span className="bg-tier-premium grid size-9 shrink-0 place-items-center rounded-xl text-white">
            <Crown className="size-[18px] fill-current" />
          </span>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            <span className="text-foreground font-semibold">
              Elevated classes boost them.
            </span>{" "}
            Standard gets the base discount; Premium, Influencer and Aura
            unlock bigger ones — Influencer is free with Instagram reach, Aura
            is invite-only.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <span className="bg-secondary/12 text-secondary grid size-9 shrink-0 place-items-center rounded-xl">
            <Sparkles className="size-[18px]" strokeWidth={2.25} />
          </span>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            <span className="text-foreground font-semibold">
              Actions beat your class.
            </span>{" "}
            A first visit or a Google review at the table pays more than your
            class rate — and the Instagram Story reward belongs to Influencers.
            You always keep your single best one, never a sum.
          </p>
        </div>

        {/* The ladder — compact rungs, the guest's own marked. */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-baseline justify-between px-1 pb-1">
            <h3 className="text-foreground text-sm font-bold tracking-tight">
              Reward tiers
            </h3>
            <span className="text-muted-foreground text-[11px]">
              You keep your best one
            </span>
          </div>
          {REWARD_SEGMENTS.map((seg) => {
            const Icon = SEGMENT_ICON[seg.key];
            const isMine = seg.key === mine;
            return (
              <div
                key={seg.key}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2.5 py-2",
                  isMine
                    ? "bg-pink-gradient text-white"
                    : "bg-muted/40 ring-border/50 ring-1 ring-inset",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg",
                    isMine ? "bg-white/20 text-white" : "bg-secondary/10 text-secondary",
                  )}
                >
                  <Icon className="size-[14px]" strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 truncate text-[12.5px] leading-tight font-bold",
                      isMine ? "text-white" : "text-foreground",
                    )}
                  >
                    {seg.name}
                    {isMine ? (
                      <span className="shrink-0 rounded-full bg-white/25 px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-widest uppercase">
                        You
                      </span>
                    ) : null}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[13px] leading-none font-extrabold tabular-nums",
                    isMine ? "text-white" : "text-foreground/80",
                  )}
                >
                  {seg.rates[PEAK_STRATEGY]}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Member scorecard — relocated from the retired passport card. */}
        {stats ? (
          <div className="border-border grid grid-cols-4 gap-1 rounded-2xl border p-3.5">
            <Stat value={String(stats.visits)} label="Visits" />
            <Stat
              value={stats.savedCents > 0 ? formatCurrency(stats.savedCents) : "—"}
              label="Saved"
            />
            <Stat value={String(stats.stories)} label="Stories" />
            <Stat value={String(stats.reviews)} label="Reviews" />
          </div>
        ) : null}
      </div>
    </LocalSheet>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center px-1 text-center">
      <span className="text-foreground text-base leading-none font-extrabold tracking-tight tabular-nums">
        {value}
      </span>
      <span className="text-muted-foreground mt-1 text-[8.5px] font-bold tracking-[0.06em] uppercase">
        {label}
      </span>
    </div>
  );
}
