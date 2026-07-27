import {
  ChartLine,
  Gauge,
  MapPin,
  QrCode,
  Store,
  Tag,
  UsersRound,
} from "lucide-react";

// `soon` sections stay in the catalog for routes/placeholders but are hidden
// from the primary tablist until shipped (MESITA-547 — dead tabs dilute IA).
// Products + Reviews live inside the Place page (not separate tabs).
const UNIT_SECTIONS = [
  { id: "place", label: "Place", Icon: Store, soon: false },
  { id: "promos", label: "Promos", Icon: Tag, soon: false },
  { id: "scores", label: "Scores", Icon: Gauge, soon: false },
  { id: "scan", label: "Scan", Icon: QrCode, soon: true },
  { id: "performance", label: "Performance", Icon: ChartLine, soon: true },
  { id: "team", label: "Team", Icon: UsersRound, soon: false },
] as const;

/** Tabs shown in UnitEditChrome — excludes not-yet-shipped sections. */
export const UNIT_TAB_SECTIONS = UNIT_SECTIONS.filter((s) => !s.soon);

export type UnitSection = (typeof UNIT_SECTIONS)[number]["id"];

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


