import { Blocks, Compass, LayoutGrid, Search } from "lucide-react";

// Discovery — ONE sidebar entry, THREE subpages (Matrix · Discovery Modes ·
// Search Sources). The prefix is frozen: /filters-config. Tabs live here so
// layout, redirects, and deep links share one list.
//
// Matrix  = how modes, sources and signals relate, plus the signal weights.
//           Neither a mode nor a source, which is why it owns a page rather
//           than riding on top of one (Pato, 2026-09-08).
// Modes   = ways guests look (each names the sources it may call).
// Sources = the nine searches themselves. Google types live here.
//
// THE SECOND TAB IS SEARCH SOURCES, NOT DISCOVERY SOURCES (Pato,
// 2026-09-02). All nine Sources are searches — every instance name ends in
// `Search` — and the matrix band on Modes has read "Search Sources" since
// it was drawn, so the tab was the odd one out. A row reading "Discovery …
// · Discovery …" under a "Product · Discovery" eyebrow also spends its
// first word repeating the eyebrow. Modes keeps the prefix: a mode is a
// Discovery surface, not a search. The ROUTE stays /sources — the entity is
// still Source, and only the page label changed.
export const FILTERS_PARENT = {
  href: "/filters-config",
  label: "Discovery",
  Icon: Compass,
} as const;

export const DISCOVERY_MATRIX_HREF = "/filters-config/matrix" as const;
export const DISCOVERY_MODES_HREF = "/filters-config/modes" as const;
const DISCOVERY_SOURCES_HREF = "/filters-config/sources" as const;
// Deep link from Intake and Manage Multiple. The Map box stays on Modes, so
// this anchor does NOT move with the split (pipeline.test.ts asserts it).
export const DISCOVERY_MAP_HREF = "/filters-config/modes#s-map" as const;

export const DISCOVERY_TABS = [
  { href: DISCOVERY_MATRIX_HREF, label: "Matrix", Icon: LayoutGrid },
  { href: DISCOVERY_MODES_HREF, label: "Discovery Modes", Icon: Search },
  { href: DISCOVERY_SOURCES_HREF, label: "Search Sources", Icon: Blocks },
] as const;
