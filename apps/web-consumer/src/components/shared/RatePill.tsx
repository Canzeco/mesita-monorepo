import { Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BADGE_SHELL,
  BADGE_SIZE_CLASS,
  BADGE_ICON_CLASS,
  type BadgeSize,
} from "./badge-sizing";

// Discount rate displayed on cards / modal headers / promo previews.
// Every Verified Partner runs an instant discount applied at the bill.

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
  size = "sm",
  className,
}: {
  percent: number;
  size?: BadgeSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        BADGE_SHELL,
        toneForPercent(percent),
        BADGE_SIZE_CLASS[size],
        className,
      )}
    >
      <Percent className={BADGE_ICON_CLASS[size]} />
      {percent}% discount
    </span>
  );
}
