import type React from "react";
import { Star } from "lucide-react";

import { Facebook, Instagram } from "../brand-icons";

import type { ChannelStat } from "./channel-stats";

export function channelStatIcon(stat: ChannelStat): React.ReactNode {
  const box = stat.mention ? "h-4 w-4" : "h-3 w-3";
  if (stat.key === "instagram") {
    return <Instagram className={`text-muted-foreground ${box}`} />;
  }
  if (stat.key === "facebook") {
    return <Facebook className={`text-muted-foreground ${box}`} />;
  }
  return (
    <Star
      className={
        stat.mention
          ? `text-muted-foreground ${box}`
          : "fill-foreground text-muted-foreground h-3 w-3"
      }
      strokeWidth={stat.mention ? 1.75 : 0}
    />
  );
}
