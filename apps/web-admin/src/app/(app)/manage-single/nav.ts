import {
  CalendarCheck,
  ChartLine,
  MapPin,
  Settings,
  Shield,
  Store,
  Tag,
} from "lucide-react";

// Tab order — Pato CEO review 2026-08-05 (MESITA-894):
// place · promos · performance · reservations · settings · admin.
//
// Reservations is its own tab (Mesita Reservationist bookings + AI dial
// lines only). Channel config stays on Settings. Performance is the
// retrospective record (money, reputation, activity) — not booking ops.
//
// Admin stays fifth-and-last, admin-console-only (never port to business).
const UNIT_SECTIONS = [
  { id: "place", label: "Place", Icon: Store },
  { id: "promos", label: "Promos", Icon: Tag },
  { id: "performance", label: "Performance", Icon: ChartLine },
  { id: "reservations", label: "Reservations", Icon: CalendarCheck },
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
