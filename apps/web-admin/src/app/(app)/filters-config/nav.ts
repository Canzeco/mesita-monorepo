import type { LucideIcon } from "lucide-react";
import {
  Grid3x3,
  Layers,
  Map,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";

// Filters Config (MESITA-1083) — one Sidebar entry, seven in-page tabs.
// General carries the law; the other six are one consumer surface each, in the
// order a guest meets them (the Home hub's four modes, then Search's map and
// list). FILTERS_SUBROUTES are tabs, never Sidebar rows.
//
// Sourcing already owns the `Filter` glyph, so this takes the sheet's own
// SlidersHorizontal — the same icon the consumer trigger wears.
export const FILTERS_PARENT = {
  href: "/filters-config",
  label: "Filters",
  Icon: SlidersHorizontal,
} as const;

export const FILTERS_SUBROUTES = [
  { href: "/filters-config/general", label: "General", Icon: Layers },
  { href: "/filters-config/swipe", label: "Swipe", Icon: SlidersHorizontal },
  { href: "/filters-config/catalog", label: "Catalog", Icon: Grid3x3 },
  { href: "/filters-config/chat", label: "Chat", Icon: MessageCircle },
  { href: "/filters-config/social", label: "Social", Icon: Users },
  { href: "/filters-config/map", label: "Map", Icon: Map },
  { href: "/filters-config/search", label: "Search", Icon: Search },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
