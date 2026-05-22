import { CircleDollarSign, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BADGE_SHELL,
  BADGE_SIZE_CLASS,
  BADGE_ICON_CLASS,
  type BadgeSize,
} from "./badge-sizing";

// Venue mechanic chip. Cashback venues route through Mesita's wallet on
// card payments; Discount venues apply the discount directly at the bill
// and Mesita stays off the payment rail. Internally the DB still stores
// fiscal_type = "formal" | "informal" (SAT-lined invoicing status) — this
// component just renders the user-facing mechanic that flows from it.
// Manager / admin surfaces only.

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
  const isCashback = fiscalType === "formal";
  const Icon = isCashback ? CircleDollarSign : Percent;
  const tone = isCashback
    ? "bg-pink-gradient text-white"
    : "bg-tier-gold text-black";
  return (
    <span
      title={
        isCashback
          ? "Cashback — routed through Stripe + the Mesita wallet"
          : "Discount — applied at the bill, Mesita stays off the rail"
      }
      className={cn(BADGE_SHELL, tone, BADGE_SIZE_CLASS[size], className)}
    >
      <Icon className={BADGE_ICON_CLASS[size]} />
      {isCashback ? "Cashback" : "Discount"}
    </span>
  );
}
