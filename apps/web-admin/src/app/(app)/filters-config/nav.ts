import type { LucideIcon } from "lucide-react";
import {
  Compass,
  Grid3x3,
  Heart,
  Layers,
  Map,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";

// Filters Config (MESITA-1083) — one Sidebar entry, "Discover" (the route
// stays /filters-config), with eight in-page tabs.
// General carries the law; the other seven are one consumer surface each, in
// the order a guest meets them: the Home hub's FIVE modes (Swipe · Catalog ·
// Chat · Social · Favorites), then Search's map and list. FILTERS_SUBROUTES are
// tabs, never Sidebar rows.
//
// Favorites was missing until MESITA-1151. It has no filter sheet to configure
// and probably never will — but a strip that lists four Home modes tells an
// operator the product has four, so the tab is the correction (it says on the
// page that the surface is sheetless).
//
// The COMPASS is the domain's mark: 🧭 is what Notion Docs › Discovery wears,
// and finding a place is what every surface under here is for. The sheet's own
// SlidersHorizontal stays below on the Swipe tab, where a filter sheet is
// literally the thing being configured — one glyph, one meaning.
export const FILTERS_PARENT = {
  href: "/filters-config",
  label: "Discover",
  Icon: Compass,
} as const;

export const FILTERS_SUBROUTES = [
  { href: "/filters-config/general", label: "General", Icon: Layers },
  { href: "/filters-config/swipe", label: "Swipe", Icon: SlidersHorizontal },
  { href: "/filters-config/catalog", label: "Catalog", Icon: Grid3x3 },
  { href: "/filters-config/chat", label: "Chat", Icon: MessageCircle },
  { href: "/filters-config/social", label: "Social", Icon: Users },
  { href: "/filters-config/favorites", label: "Favorites", Icon: Heart },
  { href: "/filters-config/map", label: "Map", Icon: Map },
  { href: "/filters-config/search", label: "Search", Icon: Search },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
