import { Activity, Compass, Search } from "lucide-react";

// Discovery — ONE sidebar entry, TWO subpages (MESITA-2303): Modes · Signals.
// The prefix is frozen: /filters-config. Tabs live here so layout, redirects,
// and deep links share one list. The sidebar row opens the first tab.
//
// Modes   = six boxes, one per mode: Explanation · Sources · Parameters · Save.
// Signals = every signal function and its computed graphic. Weights do not
//           live here: a weight belongs to a mode.
// The retired Sources and Matrix subpages redirect to Modes.
export const FILTERS_PARENT = {
  href: "/filters-config",
  label: "Discovery",
  Icon: Compass,
} as const;

export const DISCOVERY_MODES_HREF = "/filters-config/modes" as const;
export const DISCOVERY_SIGNALS_HREF = "/filters-config/signals" as const;
// Deep link from Crenup and Manage Multiple. The Map box stays on Modes.
export const DISCOVERY_MAP_HREF = "/filters-config/modes#s-map" as const;
// Catalog is a mode. Old bookmarks of the Catalog tab land on Modes.
export const DISCOVERY_CATALOG_HREF = "/filters-config/modes#s-catalog" as const;

export const DISCOVERY_TABS = [
  { href: DISCOVERY_MODES_HREF, label: "Modes", Icon: Search },
  { href: DISCOVERY_SIGNALS_HREF, label: "Signals", Icon: Activity },
] as const;
