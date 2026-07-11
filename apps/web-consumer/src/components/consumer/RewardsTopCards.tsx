"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, Info, Percent, Sparkles } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { useConsumerClass } from "@/lib/class-context";

const ORIGIN_LABEL: Record<string, string> = {
  instagram: "Instagram",
  subscription: "Subscription",
  invitation: "Invite",
};

// Two separate top cards above the passport: the conversion door (Unlock
// Premium — or, for members, Premium active) and a How-it-works opener. Kept
// as two distinct cards with a gap so each is its own tap target.
export function RewardsTopCards() {
  const { key, origin } = useConsumerClass();
  const isPremium = key === "premium";
  const [howOpen, setHowOpen] = useState(false);

  return (
    <>
      <div className="flex items-stretch gap-2.5">
        {isPremium ? (
          <Link
            href="/me"
            className="border-border bg-card flex flex-1 items-center gap-2.5 rounded-2xl border p-3 text-left transition active:scale-[0.99]"
          >
            <span className="bg-tier-premium grid size-9 shrink-0 place-items-center rounded-xl text-white">
              <Crown className="size-[18px] fill-current" />
            </span>
            <span className="min-w-0">
              <span className="text-foreground block text-[13px] leading-tight font-bold">
                Premium active
              </span>
              <span className="text-muted-foreground block truncate text-[11px]">
                via {ORIGIN_LABEL[origin] ?? "Mesita"}
              </span>
            </span>
          </Link>
        ) : (
          <Link
            href="/subscribe/premium"
            className="border-border bg-card flex flex-1 items-center gap-2.5 rounded-2xl border p-3 text-left transition active:scale-[0.99]"
          >
            <span className="bg-tier-premium grid size-9 shrink-0 place-items-center rounded-xl text-white">
              <Sparkles className="size-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="text-foreground block text-[13px] leading-tight font-bold">
                Unlock Premium
              </span>
              <span className="text-muted-foreground block truncate text-[11px]">
                Bigger discounts
              </span>
            </span>
          </Link>
        )}

        <button
          type="button"
          onClick={() => setHowOpen(true)}
          className="border-border bg-card flex flex-1 items-center gap-2.5 rounded-2xl border p-3 text-left transition active:scale-[0.99]"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff7a45,#ff2d78)] text-white">
            <Percent className="size-[18px]" strokeWidth={2.5} />
          </span>
          <span className="min-w-0">
            <span className="text-foreground block text-[13px] leading-tight font-bold">
              How it works
            </span>
            <span className="text-muted-foreground block truncate text-[11px]">
              Instant off the bill
            </span>
          </span>
        </button>
      </div>

      <LocalSheet
        open={howOpen}
        onClose={() => setHowOpen(false)}
        ariaLabel="How rewards work"
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
              Show your QR or code at the check — it comes straight off the bill.
              Mesita never holds your money.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <span className="bg-tier-premium grid size-9 shrink-0 place-items-center rounded-xl text-white">
              <Crown className="size-[18px] fill-current" />
            </span>
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              <span className="text-foreground font-semibold">
                Premium boosts them.
              </span>{" "}
              Free gets the base discount; Premium unlocks bigger ones — free
              with Instagram.
            </p>
          </div>
        </div>
      </LocalSheet>
    </>
  );
}
