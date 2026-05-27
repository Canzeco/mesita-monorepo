"use client";

import Link from "next/link";
import { Crown, ChevronRight, Sparkles } from "lucide-react";
import { CURRENT_USER, TIERS } from "@/lib/consumer-data";
import { cn } from "@/lib/utils";

// Promo strip at the top of /coupons. Pitches the tier-upgrade flow
// using the user's CURRENT tier as a reference so the message reads
// personal ("You're on Gold — Diamond gets …") instead of generic.
//
// Diamond holders see a "Top tier" confirmation chip instead of an
// upgrade CTA — there's nowhere to go.

const TIER_PROPER: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

// Order matters for the "next tier above" lookup.
const TIER_ORDER = ["bronze", "silver", "gold", "diamond"] as const;

export function ClassUpsellBox() {
  const current = CURRENT_USER.tier;
  const currentLabel = TIER_PROPER[current] ?? "Mesita";
  const currentIdx = TIER_ORDER.indexOf(
    current as (typeof TIER_ORDER)[number],
  );
  const nextTier =
    currentIdx >= 0 && currentIdx < TIER_ORDER.length - 1
      ? TIER_ORDER[currentIdx + 1]
      : null;
  const nextLabel = nextTier ? TIER_PROPER[nextTier] : null;
  const isMaxedOut = nextTier == null;

  // Diamond hits 70% on partner spend; that's the punchline that
  // motivates the climb. Smaller tiers see the same headline number to
  // keep the pitch consistent.
  const headlineDiscount = 70;

  if (isMaxedOut) {
    return (
      <div className="bg-tier-diamond shadow-glow flex items-center gap-3 rounded-2xl p-4 text-white">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <Crown className="h-4 w-4 fill-current" />
        </div>
        <div className="flex-1 leading-tight">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/85">
            Mesita Diamond
          </p>
          <p className="font-display mt-0.5 text-base font-semibold">
            Top class. You unlock every coupon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/profile"
      className="bg-pink-gradient shadow-glow group relative block overflow-hidden rounded-2xl p-5 text-white transition active:scale-[0.99]"
    >
      {/* Soft sparkle accent in the upper-right — pure decoration, lets
          the headline breathe without going flat. */}
      <Sparkles
        className="absolute top-3 right-3 h-4 w-4 text-white/40"
        strokeWidth={2}
      />
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
          <Crown className="h-5 w-5 fill-current" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/85">
            Mesita classes
          </p>
          <h3 className="font-display mt-1 text-xl leading-[1.1] font-semibold tracking-tight">
            Better class, better coupons.
          </h3>
          <p className="mt-1.5 text-[13px] leading-snug text-white/90">
            {nextLabel} members unlock up to {headlineDiscount}% off at every
            partner — bigger welcome rates, faster cashback, fewer caps.
          </p>
        </div>
      </div>

      {/* Tier ladder dots — visualizes where the user sits + how far the
          next rung is. Soft enough not to compete with the CTA. */}
      <div className="mt-4 flex items-center gap-1.5">
        {TIER_ORDER.map((tier) => {
          const reached = TIER_ORDER.indexOf(tier) <= currentIdx;
          return (
            <span
              key={tier}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                reached ? "bg-white" : "bg-white/25",
              )}
            />
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide backdrop-blur">
          You&apos;re {currentLabel}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold transition group-hover:gap-2">
          Upgrade to {nextLabel}
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}

// TIERS imported but unused at runtime — kept in scope for future
// "next reward bump at {tier}" copy that pulls from the canonical map.
void TIERS;
