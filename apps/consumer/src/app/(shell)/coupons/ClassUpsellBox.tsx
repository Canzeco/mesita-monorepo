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
import { CURRENT_USER, TIERS } from "@/lib/consumer-data";
import { cn } from "@/lib/utils";

// Promo strip at the top of /coupons. Names the four classes
// (Bronze / Silver / Gold / Diamond) explicitly and explains the
// three upgrade paths. The CTA is intentionally class-agnostic
// ("Upgrade your class") rather than tier-specific so the message
// holds for any current rung.

const TIER_PROPER: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

const TIER_ORDER = ["bronze", "silver", "gold", "diamond"] as const;

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
          <p className="mt-2 text-[13px] leading-snug text-white/90">
            Four classes at Mesita —{" "}
            <strong className="font-semibold text-white">
              Bronze, Silver, Gold, Diamond
            </strong>
            . Partners tend to offer bigger coupons to higher classes,{" "}
            <strong className="font-semibold text-white">up to 70% off</strong>.
          </p>
        </div>
      </div>

      <p className="mt-4 text-[10px] font-bold tracking-[0.18em] uppercase text-white/85">
        Three ways to upgrade
      </p>

      <ul className="mt-2 flex flex-col gap-2 text-[12.5px] leading-snug text-white/90">
        <li className="flex items-start gap-2">
          <Instagram className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/85" />
          <span>
            <strong className="font-semibold text-white">Instagram</strong>{" "}
            — connect your account and post a story each time you visit a
            partner.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CreditCard className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/85" />
          <span>
            <strong className="font-semibold text-white">Subscription</strong>{" "}
            — pay monthly to jump straight to a higher class.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/85" />
          <span>
            <strong className="font-semibold text-white">Invitation</strong>{" "}
            — free for models, executives, or anyone with real local
            influence.{" "}
            <span className="font-semibold text-white underline-offset-2 hover:underline">
              Request an invitation →
            </span>
          </span>
        </li>
      </ul>

      {/* Tier ladder dots — visualizes the four classes + where the user
          currently sits. */}
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

void TIERS;
