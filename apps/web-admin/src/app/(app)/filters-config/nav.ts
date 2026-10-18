import { Compass } from "lucide-react";

// Discovery — ONE sidebar entry, ONE page (MESITA-2327): four pipeline boxes,
// no subpages. The prefix is frozen: /filters-config. Every retired subpage
// (Modes, Signals, Sources, Matrix, Catalog, Chat, modules) redirects here
// in one hop (next.config.ts).
export const FILTERS_PARENT = {
  href: "/filters-config",
  label: "Discovery",
  Icon: Compass,
} as const;

// Deep link from Crenup, Manage Multiple and Single Place: what Google
// Search, Create and Find may admit is Discovery's place rules — Mesita's
// place types (and the stored Google floors, 0 = off, which no box edits) —
// listed under the Name Pipeline box's always-on rules (MESITA-2338).
export const DISCOVERY_MAP_HREF = "/filters-config#s-name" as const;
