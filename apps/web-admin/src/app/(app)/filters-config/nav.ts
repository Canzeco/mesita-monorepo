import { Blocks, Compass, Search } from "lucide-react";

// Discovery — ONE sidebar entry, TWO subpages (Discovery Modes ·
// Discovery Modules). The prefix is frozen: /filters-config. Tabs live
// here so layout, redirects, and deep links share one list.
//
// Modes  = ways guests look (each names the modules it may call).
// Modules = search engines + Places Lineup signals. Google types live here.
export const FILTERS_PARENT = {
  href: "/filters-config",
  label: "Discovery",
  Icon: Compass,
} as const;

export const DISCOVERY_MODES_HREF = "/filters-config/modes" as const;
const DISCOVERY_MODULES_HREF = "/filters-config/modules" as const;
export const DISCOVERY_MAP_HREF = "/filters-config/modes#s-map" as const;

export const DISCOVERY_TABS = [
  { href: DISCOVERY_MODES_HREF, label: "Discovery Modes", Icon: Search },
  { href: DISCOVERY_MODULES_HREF, label: "Discovery Modules", Icon: Blocks },
] as const;
