import {
  ChartLine,
  MapPin,
  Settings,
  Shield,
  Store,
  Tag,
} from "lucide-react";

// Tab order — Pato live 2026-08-05 (MESITA-900): place · promos ·
// performance · settings · admin. Reservations list + AI dial lines live
// inside Performance again (reverses MESITA-894's own-tab split). Channel
// config stays on Settings. Admin stays last, admin-console-only.
const UNIT_SECTIONS = [
  { id: "place", label: "Place", Icon: Store },
  { id: "promos", label: "Promos", Icon: Tag },
  { id: "performance", label: "Performance", Icon: ChartLine },
  { id: "settings", label: "Settings", Icon: Settings },
  { id: "admin", label: "Admin", Icon: Shield },
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
