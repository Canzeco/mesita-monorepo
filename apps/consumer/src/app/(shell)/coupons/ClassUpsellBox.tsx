"use client";

import Link from "next/link";
import {
  Crown,
  ChevronRight,
  Sparkles,
  Instagram,
  CreditCard,
  Mail,
} from "lucide-react";
import {
  CURRENT_USER,
  TIER_ORDER,
  tierProperLabel,
} from "@/lib/consumer-data";
import { cn } from "@/lib/utils";

// Promo strip at the top of /coupons. Folds the two memberships, the coupon
// reward range, and the lifestyle perks into one connected pitch, then lists
// the three doors into Premium as the concrete actions.
//
// Premium holders see a maxed-out variant.

export function ClassUpsellBox() {
  const current = CURRENT_USER.tier;
  const currentLabel = tierProperLabel(current);
  const currentIdx = TIER_ORDER.indexOf(
    current as (typeof TIER_ORDER)[number],
  );
  const isMaxedOut = currentIdx === TIER_ORDER.length - 1;

  if (isMaxedOut) {
    return (
      <div className="bg-tier-premium shadow-glow flex items-center gap-3 rounded-2xl p-4 text-white">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <Crown className="h-4 w-4 fill-current" />
        </div>
        <div className="flex-1 leading-tight">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/85">
            Mesita Premium
          </p>
          <p className="font-display mt-0.5 text-base font-semibold">
            Top plan. Partners give you their best rates.
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
      <Sparkles
        className="absolute top-3 right-3 h-4 w-4 text-white/40"
        strokeWidth={2}
      />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
          <Crown className="h-5 w-5 fill-current" />
        </div>
        <h3 className="font-display min-w-0 flex-1 text-xl leading-[1.1] font-semibold tracking-tight">
          Go Premium, get the best rates.
        </h3>
      </div>

      <p className="mt-3 text-[13px] leading-snug text-white/90">
        Mesita has two memberships: Free and Premium. Premium unlocks better
        cashback and discounts, better recommendations, and unlimited
        reservations — some partners compete with cashbacks up to 70%.
      </p>

      <p className="mt-4 text-[10px] font-bold tracking-[0.18em] uppercase text-white/85">
        Three ways to unlock Premium
      </p>

      {/* Method tiles. Read-only here — tapping anywhere on the promo
          navigates to /profile, where the actual Connect / Subscribe /
          Request actions live. */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[
          {
            icon: Instagram,
            label: "Instagram",
            tagline: "1K+ followers + story.",
          },
          {
            icon: CreditCard,
            label: "Subscribe",
            tagline: "$200 MXN / mo.",
          },
          {
            icon: Mail,
            label: "Invitation",
            tagline: "Models & local faces.",
          },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl bg-white/12 p-2.5 backdrop-blur ring-1 ring-white/10"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/20">
                <m.icon className="h-3.5 w-3.5 text-white" strokeWidth={2} />
              </span>
              <span className="text-[11px] font-semibold text-white">
                {m.label}
              </span>
            </div>
            <p className="mt-1 text-[10.5px] leading-snug text-white/85">
              {m.tagline}
            </p>
          </div>
        ))}
      </div>

      {/* Membership ladder dots — Free · Premium + where the user sits. */}
      <div className="mt-5 flex items-center gap-1.5">
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

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide backdrop-blur">
          You&apos;re {currentLabel}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold transition group-hover:gap-2">
          Go Premium
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}
