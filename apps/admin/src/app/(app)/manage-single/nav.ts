import {
  ChartLine,
  MapPin,
  QrCode,
  Store,
  Tag,
  UsersRound,
} from "lucide-react";

// `soon` sections are not yet built — shown in the tab bar with a "Soon" badge,
// non-navigable, and their routes render a placeholder instead of the section.
// Products + Reviews live inside the Place page (not separate tabs).
export const UNIT_SECTIONS = [
  { id: "place", label: "Place", Icon: Store, soon: false },
  { id: "promos", label: "Promos", Icon: Tag, soon: true },
  { id: "scan", label: "Scan", Icon: QrCode, soon: true },
  { id: "performance", label: "Performance", Icon: ChartLine, soon: true },
  { id: "team", label: "Team", Icon: UsersRound, soon: true },
] as const;

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

export function isManageSingleHubRoute(pathname: string): boolean {
  return pathname === "/manage-single/select" || parseUnitId(pathname) !== null;
}

/** @deprecated use isManageSingleHubRoute */
export function isEditSingleUnitRoute(pathname: string): boolean {
  return isManageSingleHubRoute(pathname);
}
