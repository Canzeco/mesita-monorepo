import {
  ChartLine,
  MapPinPlus,
  QrCode,
  SquarePen,
  Store,
  Tag,
  UsersRound,
} from "lucide-react";

export const UNIT_SECTIONS = [
  { id: "place", label: "Place", Icon: Store },
  { id: "promos", label: "Promos", Icon: Tag },
  { id: "scan", label: "Scan", Icon: QrCode },
  { id: "performance", label: "Performance", Icon: ChartLine },
  { id: "team", label: "Team", Icon: UsersRound },
] as const;

export type UnitSection = (typeof UNIT_SECTIONS)[number]["id"];

export const TOOL_ROUTES = [
  {
    href: "/manage-single/create",
    label: "Create Single Unit",
    Icon: MapPinPlus,
  },
  {
    href: "/manage-single/select",
    label: "Edit Single Unit",
    Icon: SquarePen,
  },
] as const;

export function unitSectionHref(unitId: string, section: UnitSection): string {
  return `/manage-single/${unitId}/${section}`;
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

export function isEditSingleUnitRoute(pathname: string): boolean {
  return pathname === "/manage-single/select" || parseUnitId(pathname) !== null;
}
