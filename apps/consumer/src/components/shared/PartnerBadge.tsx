import { Sparkles, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BADGE_SHELL,
  BADGE_SIZE_CLASS,
  BADGE_ICON_CLASS,
  type BadgeSize,
} from "./badge-sizing";

// Venue badge that distinguishes Verified Partners (signed up at
// manager.mesita.app, configured a coupon mechanic) from Web-Listed
// venues (scraped from Google Business, no dashboard, no coupons).
export type ListingType = "partner" | "web";

export function PartnerBadge({
  listingType,
  size = "sm",
  className,
}: {
  listingType: ListingType;
  size?: BadgeSize;
  className?: string;
}) {
  const isPartner = listingType === "partner";
  const Icon = isPartner ? Sparkles : Globe;
  const tone = isPartner
    ? "bg-tier-gold/95 text-black"
    : "bg-card/95 text-foreground border border-border";
  return (
    <span
      title={
        isPartner
          ? "Verified Partner — runs the coupon mechanic"
          : "Web-Listed — auto-sourced from Google, no coupon"
      }
      className={cn(BADGE_SHELL, tone, BADGE_SIZE_CLASS[size], className)}
    >
      <Icon className={BADGE_ICON_CLASS[size]} />
      {isPartner ? "Verified" : "Web"}
    </span>
  );
}
