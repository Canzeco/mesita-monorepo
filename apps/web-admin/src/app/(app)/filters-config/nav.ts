import { Blocks, Compass, Search } from "lucide-react";

// Discovery — ONE sidebar entry, TWO subpages (Search Modes · Search
// Modules). The prefix is frozen: /filters-config. Tabs live here so
// layout, redirects, and deep links share one list.
//
// Modes  = ways guests look.
// Modules = shared parameters and the Signals library.
export const FILTERS_PARENT = {
  href: "/filters-config",
  label: "Discovery",
  Icon: Compass,
} as const;

export const DISCOVERY_MODES_HREF = "/filters-config/modes" as const;
export const DISCOVERY_MODULES_HREF = "/filters-config/modules" as const;
export const DISCOVERY_MAP_HREF = "/filters-config/modes#s-map" as const;

export const DISCOVERY_TABS = [
  { href: DISCOVERY_MODES_HREF, label: "Search Modes", Icon: Search },
  { href: DISCOVERY_MODULES_HREF, label: "Search Modules", Icon: Blocks },
] as const;
