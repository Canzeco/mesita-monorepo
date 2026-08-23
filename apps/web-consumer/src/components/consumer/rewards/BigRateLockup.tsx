"use client";

// BigRateLockup — the "Big number" (design D3/D6): the guest's rate as the
// interface. Gradient clamp numeral + a conditional suffix baked into the
// lockup so a percentage never reads as granted before its action is done.
// Every rate rendered through this component comes from
// rateForSegment()/peakRateForClass() — never a hardcoded number.

import { cn } from "@/lib/utils";

export function BigRateLockup({
  percent,
  suffix,
  caption,
  size = "hero",
  className,
}: {
  /** The computed rate (rateForSegment) — caller guarantees > 0. */
  percent: number;
  /** Conditional clause, e.g. "— with a Google review". Required so the
   *  number never floats context-free; pass "" only for settled tickets. */
  suffix: string;
  /** Optional line above the numeral, e.g. "Your discount at Strana". */
  caption?: string;
  size?: "hero" | "recap";
  className?: string;
}) {
  return (
    <div aria-live="polite" className={cn("text-center", className)}>
      {caption ? (
        <p className="text-muted-foreground text-xs font-semibold">{caption}</p>
      ) : null}
      <p
        className={cn(
          "font-display text-pink-gradient leading-[0.95] font-extrabold tracking-tight transition-transform duration-150 motion-reduce:transition-none",
          size === "hero"
            ? "text-[clamp(56px,18vw,72px)]"
            : "text-[clamp(36px,11vw,44px)]",
        )}
      >
        {percent}%
      </p>
      {suffix ? (
        <p className="text-foreground type-body mt-1 leading-snug font-bold">
          {suffix}
        </p>
      ) : null}
    </div>
  );
}
