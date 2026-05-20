import { CircleDollarSign, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BADGE_SHELL,
  BADGE_SIZE_CLASS,
  BADGE_ICON_CLASS,
  type BadgeSize,
} from "./badge-sizing";

// Venue fiscal type — pins the coupon mechanic. Formal venues run cashback
// (Mesita on the payment rail); informal venues run instant discounts
// (Mesita off the rail). Manager / admin surfaces only.

export type FiscalType = "formal" | "informal";

export function FiscalBadge({
  fiscalType,
  size = "sm",
  className,
}: {
  fiscalType: FiscalType;
  size?: BadgeSize;
  className?: string;
}) {
  const isFormal = fiscalType === "formal";
  const Icon = isFormal ? CircleDollarSign : Percent;
  const tone = isFormal
    ? "bg-pink-gradient text-white"
    : "bg-tier-gold text-black";
  return (
    <span
      title={
        isFormal
          ? "Formal — cashback via Stripe + Mesita wallet"
          : "Informal — instant discount at the bill, cash settles off-rail"
      }
      className={cn(BADGE_SHELL, tone, BADGE_SIZE_CLASS[size], className)}
    >
      <Icon className={BADGE_ICON_CLASS[size]} />
      {isFormal ? "Formal" : "Informal"}
    </span>
  );
}
