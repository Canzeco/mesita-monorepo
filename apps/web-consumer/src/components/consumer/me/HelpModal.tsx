"use client";

// Help — the single education home for the reward program (MESITA-809):
// how rewards work plus the seven-rung tier ladder. Lives on Me, not on
// Rewards: the wallet is for doing, this is for understanding. Opened from
// the Me > Help row.

import type { LucideIcon } from "lucide-react";
import {
  DoorOpen,
  Info,
  Instagram,
  Percent,
  Sparkles,
  Star,
} from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { useConsumerClass } from "@/lib/class-context";
import { CLASS_ICONS, CLASS_MARK_ICON } from "@/lib/consumer-data";
import {
  PEAK_STRATEGY,
  REWARD_SEGMENTS,
  segmentKeyForClass,
  type RewardSegmentKey,
} from "@/lib/reward-segments";
import { cn } from "@/lib/utils";

const SEGMENT_ICON: Record<RewardSegmentKey, LucideIcon> = {
  bronze: CLASS_ICONS.bronze,
  silver: CLASS_ICONS.silver,
  gold: CLASS_ICONS.gold,
  diamond: CLASS_ICONS.diamond,
  story: Instagram,
  welcome: DoorOpen,
  review: Star,
};

export function HelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { key: classKey } = useConsumerClass();
  const mine = segmentKeyForClass(classKey);

  return (
    <LocalSheet
      open={open}
      onClose={onClose}
      ariaLabel="Help — how rewards work"
    >
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
            <CLASS_MARK_ICON className="size-[18px]" />
          </span>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            <span className="text-foreground font-semibold">
              Elevated classes boost them.
            </span>{" "}
            Bronze gets the base discount; Silver, Gold and Diamond unlock
            bigger ones — Silver and Gold are free with Instagram reach,
            Diamond is invite-only. Premium is a separate subscription that
            raises your rate at any class.
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
            A first visit, a Google review, or an Instagram story (with
            Instagram connected) can pay more than your class rate. You always
            keep your single best one, never a sum.
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
                    isMine
                      ? "bg-white/20 text-white"
                      : "bg-secondary/10 text-secondary",
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
      </div>
    </LocalSheet>
  );
}
