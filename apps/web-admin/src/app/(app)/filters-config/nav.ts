import { Activity, Blocks, Compass, LayoutGrid, Search } from "lucide-react";

// Discovery — ONE sidebar entry, FOUR subpages (Sources · Modes · Signals ·
// Matrix). The prefix is frozen: /filters-config. Tabs live here so
// layout, redirects, and deep links share one list. The sidebar row opens
// the first tab (Pato, 2026-10-13).
//
// Matrix  = how modes and sources relate. Read-only. Routing is fixed.
// Signals = the function each signal computes. Shape numbers live here.
//           Weights do not: a weight belongs to a mode.
// Modes   = ways guests look, plus the weights of the modes that rank.
//           Catalog is a mode on this page, not its own tab.
// Sources = the seven searches themselves. Google types live here.
export const FILTERS_PARENT = {
  href: "/filters-config",
  label: "Discovery",
  Icon: Compass,
} as const;

export const DISCOVERY_MATRIX_HREF = "/filters-config/matrix" as const;
export const DISCOVERY_MODES_HREF = "/filters-config/modes" as const;
export const DISCOVERY_SIGNALS_HREF = "/filters-config/signals" as const;
const DISCOVERY_SOURCES_HREF = "/filters-config/sources" as const;
// Deep link from Crenup and Manage Multiple. The Map box stays on Modes.
export const DISCOVERY_MAP_HREF = "/filters-config/modes#s-map" as const;
// Catalog is a mode. Old bookmarks of the Catalog tab land on Modes.
export const DISCOVERY_CATALOG_HREF = "/filters-config/modes#s-catalog" as const;

export const DISCOVERY_TABS = [
  { href: DISCOVERY_SOURCES_HREF, label: "Sources", Icon: Blocks },
  { href: DISCOVERY_MODES_HREF, label: "Modes", Icon: Search },
  { href: DISCOVERY_SIGNALS_HREF, label: "Signals", Icon: Activity },
  { href: DISCOVERY_MATRIX_HREF, label: "Matrix", Icon: LayoutGrid },
] as const;
