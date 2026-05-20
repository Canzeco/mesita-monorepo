import { Crown, Sparkles, Award, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BADGE_SHELL,
  BADGE_SIZE_CLASS,
  BADGE_ICON_CLASS,
  type BadgeSize,
} from "./badge-sizing";

// Guest class — the four-tier ladder. Bronze is the default; Silver / Gold
// / Diamond scale on either Instagram follower count or a monthly Mesita
// subscription ($200 / $500 / $1,000 MXN). The class IS the brand — a
// subscriber is "Mesita Silver", not "a Silver member". Diamond can also
// be granted by invite or manual appeal.
export type Tier = "bronze" | "silver" | "gold" | "diamond";

const TIER_STYLE: Record<Tier, { tone: string; Icon: typeof Crown }> = {
  bronze: { tone: "bg-tier-bronze/90 text-white", Icon: Medal },
  silver: { tone: "bg-tier-silver text-foreground", Icon: Award },
  gold: { tone: "bg-tier-gold text-black", Icon: Sparkles },
  diamond: { tone: "bg-tier-diamond text-white", Icon: Crown },
};

const TIER_LABEL: Record<Tier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

export function TierBadge({
  tier,
  size = "sm",
  className,
}: {
  tier: Tier;
  size?: BadgeSize;
  className?: string;
}) {
  const { tone, Icon } = TIER_STYLE[tier];
  return (
    <span className={cn(BADGE_SHELL, tone, BADGE_SIZE_CLASS[size], className)}>
      <Icon className={BADGE_ICON_CLASS[size]} />
      {TIER_LABEL[tier]}
    </span>
  );
}
