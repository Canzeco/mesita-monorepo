"use client";

import Link from "next/link";
import {
  Crown,
  ChevronRight,
  Sparkles,
  Instagram,
  Linkedin,
  CreditCard,
  Mail,
} from "lucide-react";
import { CURRENT_USER, TIER_ORDER } from "@/lib/consumer-data";
import { cn } from "@/lib/utils";

// Promo strip at the top of /coupons. Single paragraph folds the
// class names, the coupon discount range, and the lifestyle perks
// (exclusive venues, priority booking, table gifts) into one
// connected pitch — the prior two-section split read as redundant
// because all three lived under the same "why care" umbrella.
//
// Four ways to climb listed after as the concrete actions. CTA is
// class-agnostic ("Upgrade your class") so the copy holds at any rung.
//
// Diamond holders see a maxed-out variant.

const TIER_PROPER: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

export function ClassUpsellBox() {
  const current = CURRENT_USER.tier;
  const currentLabel = TIER_PROPER[current] ?? "Mesita";
  const currentIdx = TIER_ORDER.indexOf(
    current as (typeof TIER_ORDER)[number],
  );
  const isMaxedOut = currentIdx === TIER_ORDER.length - 1;

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
            Top class. Partners give you their best rates.
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

      {/* Header row — crown badge + title, side by side. The body text
          and everything below flow at full width so the column under
          the crown isn't an empty rail. */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
          <Crown className="h-5 w-5 fill-current" />
        </div>
        <h3 className="font-display min-w-0 flex-1 text-xl leading-[1.1] font-semibold tracking-tight">
          Better class, better coupons.
        </h3>
      </div>

      {/* Body — full-width paragraph. Class names → coupon mechanic →
          partner-competition framing → italic "make your social capital
          spendable" sign-off. */}
      <p className="mt-3 text-[13px] leading-snug text-white/90">
        Mesita has four classes:{" "}
        <strong className="font-semibold text-white">
          Bronze, Silver, Gold, and Diamond
        </strong>
        . The higher your class, the bigger your coupons. Our partners
        compete with coupons,{" "}
        <strong className="font-semibold text-white">up to 70% off</strong>,
        to attract the high-value guests.{" "}
        <em className="font-display text-white/95">
          Upgrade to make your social capital spendable.
        </em>
      </p>

      <p className="mt-4 text-[10px] font-bold tracking-[0.18em] uppercase text-white/85">
        Four ways to climb
      </p>

      {/* 2×2 grid of glassy method tiles. Each tile is read-only here
          — tapping anywhere on the promo navigates to /profile (the
          parent Link), where the actual Connect / Subscribe / Request
          actions live. Keeps the promo as a single tap target while
          still showing the four paths visually. */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[
          {
            icon: Instagram,
            label: "Instagram",
            tagline: "Post a story each visit",
          },
          {
            icon: Linkedin,
            label: "LinkedIn",
            tagline: "Verify role + followers",
          },
          {
            icon: CreditCard,
            label: "Subscribe",
            tagline: "Pay monthly to jump",
          },
          {
            icon: Mail,
            label: "Invitation",
            tagline: "For real-influence locals",
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
              <span className="text-[12px] font-semibold text-white">
                {m.label}
              </span>
            </div>
            <p className="mt-1 text-[10.5px] leading-snug text-white/85">
              {m.tagline}
            </p>
          </div>
        ))}
      </div>

      {/* Tier ladder dots — visualizes the four classes + where the user
          currently sits. */}
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
          Upgrade your class
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}
