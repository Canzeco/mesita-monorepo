import type { PlaceSubTab } from "@/components/business/place/place-subtabs";
import {
  isPlaceSubTab,
  resolvePlaceSubTab,
} from "@/components/business/place/place-subtabs";

export const BUSINESS_ROUTES = {
  central: "/central",
  // Account-level settings (billing, sign-out) — distinct from the per-place
  // Settings tab, which is `place/<id>/settings`.
  settings: "/settings",
  add: "/add",
  onboard: "/onboard",
} as const;

type PlaceSection = "performance" | "settings";

export function placePath(
  projectId: string,
  tab: PlaceSubTab = "preview",
): string {
  return `/place/${projectId}/place/${tab}`;
}

export function promosPath(projectId: string): string {
  return `/place/${projectId}/promos`;
}

function placeSectionPath(projectId: string, section: PlaceSection): string {
  return `/place/${projectId}/${section}`;
}

export function resolvePlaceTab(
  segment: string | null | undefined,
): PlaceSubTab | null {
  if (!segment) return null;
  if (isPlaceSubTab(segment)) return segment;
  if (segment === "photos" || segment === "menu") return "media";
  return null;
}

export function pathnamePlaceId(pathname: string): string | null {
  return pathname.match(/^\/place\/([^/]+)/)?.[1] ?? null;
}

export function dockHrefForSection(
  section: "place" | "promos" | "performance" | "settings",
  activePlaceId: string | null,
): string {
  if (section === "place") return BUSINESS_ROUTES.central;
  if (!activePlaceId) return BUSINESS_ROUTES.add;
  if (section === "promos") return promosPath(activePlaceId);
  return placeSectionPath(activePlaceId, section);
}

export function placeSwitchHref(projectId: string, pathname: string): string {
  const placeTab = pathname.match(/\/place\/([^/]+)/)?.[1];
  const section = pathname.match(/^\/place\/[^/]+\/([^/]+)/)?.[1];

  if (section === "place") {
    return placePath(projectId, resolvePlaceSubTab(placeTab ?? null));
  }
  if (section === "promos") {
    return promosPath(projectId);
  }
  if (section === "performance" || section === "reservations") {
    // MESITA-900 — old /reservations URLs land on Performance.
    return placeSectionPath(projectId, "performance");
  }
  if (section === "settings") return placeSectionPath(projectId, "settings");
  // The retired check surface (scan/tickets) and the old standalone team tab
  // all land back on the place when you switch places.
  return placePath(projectId);
}
