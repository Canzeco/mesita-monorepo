import { ChartLine, MapPin, Settings, Store, Tag } from "lucide-react";

// Tab order is Pato's 2026-08-02/03 spec (MESITA-834 + amendments):
// place · promos · performance · settings. Everything else folded INTO one
// of the four (old URLs redirect): Products → Place; Team → Settings;
// Reviews → Performance (reputation IS performance); Scores + Scan deleted.
// Performance = the reviews cards + the per-place app-activity feed;
// Settings = business team + operator/meta cards.
const UNIT_SECTIONS = [
  { id: "place", label: "Place", Icon: Store },
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
