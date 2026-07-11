import type { PlaceSubTab } from "@/components/business/place/place-subtabs";
import {
  isPlaceSubTab,
  resolvePlaceSubTab,
} from "@/components/business/place/place-subtabs";
import type { PromosSubTab } from "@/components/business/promos/promos-subtabs";
import {
  isPromosSubTab,
  resolvePromosSubTab,
} from "@/components/business/promos/promos-subtabs";

export const BUSINESS_ROUTES = {
  central: "/central",
  settings: "/settings",
  add: "/add",
  onboard: "/onboard",
} as const;

export type UnitSection = "scan" | "performance" | "team";

export function placePath(projectId: string, tab: PlaceSubTab = "preview"): string {
  return `/unit/${projectId}/place/${tab}`;
}

export function promosPath(
  projectId: string,
  tab: PromosSubTab = "plan",
): string {
  return `/unit/${projectId}/promos/${tab}`;
}

export function unitSectionPath(projectId: string, section: UnitSection): string {
  return `/unit/${projectId}/${section}`;
}

export function resolvePlaceTab(segment: string | null | undefined): PlaceSubTab | null {
  if (!segment) return null;
  if (isPlaceSubTab(segment)) return segment;
  if (segment === "photos" || segment === "menu") return "media";
  return null;
}

export function resolvePromosTab(
  segment: string | null | undefined,
): PromosSubTab | null {
  if (!segment) return null;
  return isPromosSubTab(segment) ? segment : null;
}

export function pathnameUnitId(pathname: string): string | null {
  return pathname.match(/^\/unit\/([^/]+)/)?.[1] ?? null;
}

export function dockHrefForSection(
  section: "place" | "promos" | "scan" | "performance" | "team",
  activeUnitId: string | null,
): string {
  if (section === "place") return BUSINESS_ROUTES.central;
  if (!activeUnitId) return BUSINESS_ROUTES.add;
  if (section === "promos") return promosPath(activeUnitId);
  return unitSectionPath(activeUnitId, section);
}

export function placeSwitchHref(
  projectId: string,
  pathname: string,
): string {
  const placeTab = pathname.match(/\/place\/([^/]+)/)?.[1];
  const promosTab = pathname.match(/\/promos\/([^/]+)/)?.[1];
  const section = pathname.match(/^\/unit\/[^/]+\/([^/]+)/)?.[1];

  if (section === "place") {
    return placePath(projectId, resolvePlaceSubTab(placeTab ?? null));
  }
  if (section === "promos") {
    return promosPath(projectId, resolvePromosSubTab(promosTab ?? null));
  }
  if (section === "scan") return unitSectionPath(projectId, "scan");
  if (section === "performance") return unitSectionPath(projectId, "performance");
  if (section === "team") return unitSectionPath(projectId, "team");
  return placePath(projectId);
}
