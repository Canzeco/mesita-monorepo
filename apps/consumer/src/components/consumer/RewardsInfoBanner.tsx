import { Percent, Crown } from "lucide-react";

// Brief explainer at the top of the Rewards surface (above the QR / Tickets
// toggle). Two lines: what the rewards program is (instant discounts at the
// check) and what Premium adds on top. Static + page-level.
//
// Light-theme premium treatment — a branded gradient tint + tinted icon
// circles, semantic tokens only (no bg-zinc/text-white on the surface).
// Discounts-only language: never "cashback"/"wallet" — Mesita holds no money,
// the discount lands straight on the bill.
export function RewardsInfoBanner() {
  return (
    <div className="border-border/70 from-primary/5 via-secondary/5 to-accent/5 rounded-2xl border bg-gradient-to-br p-3.5">
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
        How Rewards work
      </p>

      <div className="mt-2.5 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <span className="bg-secondary/12 text-secondary flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
            <Percent className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <p className="text-foreground text-[12.5px] leading-snug">
            <span className="font-semibold">Instant discounts.</span>{" "}
            <span className="text-muted-foreground">
              Show your QR or 8-digit code when you ask for the check — the
              discount comes straight off the bill. Mesita never holds your
              money.
            </span>
          </p>
        </div>

        <div className="flex items-start gap-2.5">
          <span className="bg-tier-premium flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white">
            <Crown className="h-4 w-4 fill-current" />
          </span>
          <p className="text-foreground text-[12.5px] leading-snug">
            <span className="font-semibold">Premium boosts them.</span>{" "}
            <span className="text-muted-foreground">
              Free gets the base discount; Premium unlocks bigger discounts,
              personalized picks &amp; unlimited reservations.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
