import {
  ChartLine,
  MapPin,
  Package,
  Settings,
  Star,
  Store,
  Tag,
} from "lucide-react";

// Tab order is Pato's 2026-08-02 spec (MESITA-834, amended same day):
// place · reviews · products · promos · performance · settings. Reviews +
// Products are their own tabs again (MESITA-368 folded them into Place;
// unfolded here); Scores and Scan are gone from the catalog and Team folded
// INTO Settings (their old URLs redirect). Settings holds the business team
// + operator/meta cards; Performance is the per-place activity feed.
const UNIT_SECTIONS = [
  { id: "place", label: "Place", Icon: Store },
  { id: "reviews", label: "Reviews", Icon: Star },
  { id: "products", label: "Products", Icon: Package },
  { id: "promos", label: "Promos", Icon: Tag },
  { id: "performance", label: "Performance", Icon: ChartLine },
  { id: "settings", label: "Settings", Icon: Settings },
] as const;

/** Tabs shown in UnitEditChrome — every section is live (no `soon` gate). */
export const UNIT_TAB_SECTIONS = UNIT_SECTIONS;

type UnitSection = (typeof UNIT_SECTIONS)[number]["id"];

export const TOOL_ROUTES = [
  {
    href: "/manage-single/select",
    label: "Manage Single Unit",
    Icon: MapPin,
  },
] as const;

export function unitSectionHref(projectId: string, section: UnitSection): string {
  return `/manage-single/${projectId}/${section}`;
}

export function isUnitSection(value: string | null | undefined): value is UnitSection {
  return UNIT_SECTIONS.some((s) => s.id === value);
}

export function parseUnitId(pathname: string): string | null {
  const m = pathname.match(/^\/manage-single\/([^/]+)(?:\/|$)/);
  if (!m) return null;
  const id = m[1];
  if (id === "select" || id === "create" || id === "add") return null;
  return id;
}
