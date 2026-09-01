import {
  ChartLine,
  MapPin,
  SlidersHorizontal,
  Store,
  User,
} from "lucide-react";

// Tab order — Pato live 2026-09-01: place · promos · performance · admin.
// FOUR tabs: Profile · Controls · Activity · Admin. Partnership and Settings
// merged into ONE tab (Controls) — every knob a place has now sits together,
// and Team was the only box Settings still owned after the rails moved off it
// (2026-08-30). Reservations list + AI dial lines live inside Activity. Admin
// stays last, admin-console-only.
/** Tabs shown in PlaceEditChrome. `soon: true` = parked: the tab renders
 *  disabled and its route serves a placeholder instead of the live section. */
export const PLACE_TAB_SECTIONS = [
  // decision: Pato live 2026-08-25 — Profile is the place (Store).
  // ShoppingBag is Orders; Handshake stays off so Admin keeps the person glyph.
  { id: "place", label: "Profile", Icon: Store, soon: false },
  // decision: Pato live 2026-09-01 — tab label Controls (route `/promos`
  // frozen; a rename never reaches the URL, same as Partnership before it).
  // The tab holds everything the place is SET to: the subscription, Visit
  // Rewards, the three rail boxes, and Team. Percent went with the
  // Partnership label — a sliders glyph is the whole tab now, not one box.
  { id: "promos", label: "Controls", Icon: SlidersHorizontal, soon: false },
  // decision: Pato live 2026-09-01 — Performance is now Activity (route
  // `/performance` frozen). Still parked behind Soon (Pato, 2026-08-09): the
  // per-place feed reads as empty scaffolding on real places, so it's blocked
  // rather than shown half-true. The feed itself is untouched underneath —
  // flip this back to `false` to un-park it in one line.
  { id: "performance", label: "Activity", Icon: ChartLine, soon: true },
  { id: "admin", label: "Admin", Icon: User, soon: false },
] as const;

type PlaceSectionId = (typeof PLACE_TAB_SECTIONS)[number]["id"];

/** True while `section` is parked behind the Soon gate. */
export function isSectionSoon(section: PlaceSectionId): boolean {
  return PLACE_TAB_SECTIONS.some((s) => s.id === section && s.soon);
}

export const TOOL_ROUTES = [
  {
    href: "/manage-single/select",
    label: "Single Place",
    Icon: MapPin,
  },
] as const;

export function placeSectionHref(projectId: string, section: PlaceSectionId): string {
  return `/manage-single/${projectId}/${section}`;
}

export function isPlaceSectionId(value: string | null | undefined): value is PlaceSectionId {
  return PLACE_TAB_SECTIONS.some((s) => s.id === value);
}

export function parsePlaceId(pathname: string): string | null {
  const m = pathname.match(/^\/manage-single\/([^/]+)(?:\/|$)/);
  if (!m) return null;
  const id = m[1];
  if (id === "select" || id === "create" || id === "add") return null;
  return id;
}
