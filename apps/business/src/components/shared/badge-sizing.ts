// Shared sizing for the badge family (TierBadge, PartnerBadge, RatePill,
// FiscalBadge). One place to tune padding / font-size / gap / icon size
// instead of four. The icon class is exported so each badge can keep
// using its lucide-react icon at the right scale.

export type BadgeSize = "xs" | "sm" | "md";

export const BADGE_SIZE_CLASS: Record<BadgeSize, string> = {
  xs: "px-1.5 py-0.5 text-[9px] gap-0.5",
  sm: "px-2 py-0.5 text-[10px] gap-1",
  md: "px-2.5 py-1 text-[11px] gap-1.5",
};

export const BADGE_ICON_CLASS: Record<BadgeSize, string> = {
  xs: "h-2.5 w-2.5",
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
};

// The common shell — `inline-flex` + rounded-full + uppercase. Every badge
// uses this; only the colour tone changes per component.
export const BADGE_SHELL =
  "inline-flex items-center rounded-full font-bold uppercase tracking-wider shadow-sm";
