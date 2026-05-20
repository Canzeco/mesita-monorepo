import { CircleDollarSign, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BADGE_SHELL,
  BADGE_SIZE_CLASS,
  BADGE_ICON_CLASS,
  type BadgeSize,
} from "./badge-sizing";

// Coupon rate displayed on cards / modal headers / promo previews.
// Mechanic decides the suffix: "cashback" on formal venues, "discount"
// on informal venues. Same component, two readings.

export type Mechanic = "cashback" | "discount";

// Mesita's canonical rate rungs: 5 / 10 / 20 / 50. Bands sit between rungs
// so a 7% still reads as the 5% tier visually, a 23% reads as the 20%
// tier, etc. The order matters — we walk from lightest to most saturated.
const RATE_BANDS: { max: number; tone: string }[] = [
  { max: 0, tone: "bg-muted text-muted-foreground" },
  { max: 10, tone: "bg-secondary/30 text-foreground" },
  { max: 20, tone: "bg-secondary/60 text-secondary-foreground" },
  { max: 50, tone: "bg-pink-gradient text-white" },
  { max: Infinity, tone: "bg-pink-gradient text-white shadow-glow" },
];

function toneForPercent(p: number): string {
  for (const band of RATE_BANDS) {
    if (p <= band.max) return band.tone;
  }
  // Unreachable (last band has max: Infinity) but keeps the type checker happy.
  return RATE_BANDS[RATE_BANDS.length - 1].tone;
}

export function RatePill({
  percent,
  mechanic,
  size = "sm",
  className,
}: {
  percent: number;
  mechanic: Mechanic;
  size?: BadgeSize;
  className?: string;
}) {
  const Icon = mechanic === "cashback" ? CircleDollarSign : Percent;
  const label = mechanic === "cashback" ? "cashback" : "discount";
  return (
    <span
      className={cn(
        BADGE_SHELL,
        toneForPercent(percent),
        BADGE_SIZE_CLASS[size],
        className,
      )}
    >
      <Icon className={BADGE_ICON_CLASS[size]} />
      {percent}% {label}
    </span>
  );
}
