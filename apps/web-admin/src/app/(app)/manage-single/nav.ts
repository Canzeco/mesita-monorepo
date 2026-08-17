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
/** Tabs shown in UnitEditChrome. `soon: true` = parked: the tab renders
 *  disabled and its route serves a placeholder instead of the live section. */
export const UNIT_TAB_SECTIONS = [
  { id: "place", label: "Place", Icon: Store, soon: false },
  { id: "promos", label: "Promos", Icon: Tag, soon: false },
  // decision: Pato live 2026-08-09 — Performance is parked behind Soon. The
  // per-place feed reads as empty scaffolding on real places, so it's blocked
  // rather than shown half-true. The feed itself is untouched underneath —
  // flip this back to `false` to un-park it in one line.
  { id: "performance", label: "Performance", Icon: ChartLine, soon: true },
  { id: "settings", label: "Settings", Icon: Settings, soon: false },
  { id: "admin", label: "Admin", Icon: Shield, soon: false },
] as const;

type UnitSection = (typeof UNIT_TAB_SECTIONS)[number]["id"];

/** True while `section` is parked behind the Soon gate. */
export function isSectionSoon(section: UnitSection): boolean {
  return UNIT_TAB_SECTIONS.some((s) => s.id === section && s.soon);
}

export const TOOL_ROUTES = [
  {
    href: "/manage-single/select",
    label: "Single Unit",
    Icon: MapPin,
  },
] as const;

export function unitSectionHref(projectId: string, section: UnitSection): string {
  return `/manage-single/${projectId}/${section}`;
}

export function isUnitSection(value: string | null | undefined): value is UnitSection {
  return UNIT_TAB_SECTIONS.some((s) => s.id === value);
}

export function parseUnitId(pathname: string): string | null {
  const m = pathname.match(/^\/manage-single\/([^/]+)(?:\/|$)/);
  if (!m) return null;
  const id = m[1];
  if (id === "select" || id === "create" || id === "add") return null;
  return id;
}
