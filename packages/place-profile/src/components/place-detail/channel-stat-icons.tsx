import type React from "react";

import { FacebookLogo, GoogleLogo, InstagramLogo } from "../BrandLogos";

import type { ChannelStat } from "./channel-stats";

// Order is fixed by profileChannelStats: Google, then Instagram, then Facebook.
// Each column leads with that network's own mark, never a stand-in star.
export function channelStatIcon(stat: ChannelStat): React.ReactNode {
  if (stat.key === "instagram") return <InstagramLogo compact />;
  if (stat.key === "facebook") return <FacebookLogo compact />;
  return <GoogleLogo compact />;
}
