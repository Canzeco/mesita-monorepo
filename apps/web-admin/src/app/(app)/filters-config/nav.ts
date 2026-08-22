import type { LucideIcon } from "lucide-react";
import { Compass, Layers, SlidersHorizontal } from "lucide-react";

// Discovery (MESITA-1083) — ONE Sidebar entry, TWO pages (Pato, 2026-08-21:
// "In discover I only want two pages / Signals & Engines"). The route stays
// /filters-config; a rename stops at the label.
//
// The two pages are the two axes the data model always had: SIGNALS are the
// six modules a guest can express (context · where · distance · when · what ·
// random), ENGINES are the surfaces that answer with places. It was General
// plus seven surface tabs, and the Chat tab carried four subpages of its own.
//
// The COMPASS is the domain's mark: it is what Notion Docs › Discovery wears,
// and finding a place is what everything under here is for.
export const FILTERS_PARENT = {
  href: "/filters-config",
  label: "Discovery",
  Icon: Compass,
} as const;

export const FILTERS_SUBROUTES = [
  { href: "/filters-config/signals", label: "Signals", Icon: SlidersHorizontal },
  { href: "/filters-config/engines", label: "Engines", Icon: Layers },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
