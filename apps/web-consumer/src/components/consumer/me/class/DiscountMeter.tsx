"use client";

import { cn } from "@/lib/utils";

export type DiscountLevel = "LOW" | "HIGH" | "EXTRA" | "MAX";

const LEVEL_META: Record<
  DiscountLevel,
  { filled: number; fillClass: string }
> = {
  LOW: { filled: 1, fillClass: "bg-pink-gradient" },
  HIGH: { filled: 2, fillClass: "bg-gradient-to-r from-sky-400 to-sky-600" },
  EXTRA: { filled: 3, fillClass: "bg-tier-premium" },
  MAX: {
    filled: 4,
    fillClass: "bg-gradient-to-r from-amber-500 to-amber-300",
  },
};

/** Qualitative LOW→MAX discount ladder — hero signal on Class climb cards. */
export function DiscountMeter({ level }: { level: DiscountLevel }) {
  const { filled, fillClass } = LEVEL_META[level];

  return (
    <div
      className="bg-muted rounded-xl p-2.5"
      role="img"
      aria-label={`Discount Rewards level: ${level} (${filled} of 4)`}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-extrabold tracking-wide">{level}</span>
        <span className="text-muted-foreground text-[10px] font-semibold">
          Discount Rewards
        </span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full",
              i <= filled ? fillClass : "bg-[#e5d4d6]",
            )}
          />
        ))}
      </div>
    </div>
  );
}
