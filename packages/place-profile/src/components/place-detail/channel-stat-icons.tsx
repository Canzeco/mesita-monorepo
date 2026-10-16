import type React from "react";
import { Star } from "lucide-react";

import { Facebook, Instagram } from "../brand-icons";

import type { ChannelStat } from "./channel-stats";

const STAR = (
  <Star
    className="fill-foreground text-muted-foreground h-3 w-3"
    strokeWidth={0}
  />
);

export function channelStatIcon(stat: ChannelStat): React.ReactNode {
  if (stat.googleShowStar) return STAR;
  if (stat.key === "instagram") {
    return <Instagram className="text-muted-foreground h-3 w-3" />;
  }
  if (stat.key === "facebook") {
    return <Facebook className="text-muted-foreground h-3 w-3" />;
  }
  return undefined;
}
