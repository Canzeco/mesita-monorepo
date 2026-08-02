"use client";

// The wallet's context strip (MESITA-808, decision 1A) — FLAT by design: the
// only gradient on this page belongs to the live ticket / Start hero. One
// line of orientation (class + ceiling), the education door, and the Premium
// door for Standard guests. Replaces the RewardProgramCard banner and both
// RewardsTopCards cards.

import Link from "next/link";
import { ChevronRight, Crown, Sparkles } from "lucide-react";

import { useConsumerClass } from "@/lib/class-context";
import { classProperLabel, isElevatedClass } from "@/lib/consumer-data";
import { peakRateForClass } from "@/lib/reward-segments";
import { cn } from "@/lib/utils";

export function ContextStrip({ onOpenHow }: { onOpenHow: () => void }) {
  const { key } = useConsumerClass();
  const isElevated = isElevatedClass(key);
  const peak = peakRateForClass(key);

  return (
    <div className="border-border bg-card flex min-h-11 items-center gap-2.5 rounded-2xl border px-3.5 py-2.5">
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-widest uppercase",
          isElevated ? "bg-tier-premium/10 text-premium" : "bg-primary/10 text-primary",
        )}
      >
        {classProperLabel(key)}
      </span>
      <p className="text-foreground min-w-0 flex-1 truncate text-[12.5px] font-semibold">
        Up to {peak}% off for you
      </p>
      {!isElevated ? (
        <Link
          href="/subscribe/premium"
          className="text-premium flex shrink-0 items-center gap-1 text-[11.5px] font-bold"
        >
          <Crown className="size-3.5 fill-current" /> Premium
        </Link>
      ) : null}
      <button
        type="button"
        onClick={onOpenHow}
        className="text-muted-foreground hover:text-foreground flex min-h-11 shrink-0 items-center gap-0.5 text-[11.5px] font-semibold transition"
      >
        <Sparkles className="size-3.5" /> How it works
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
}
