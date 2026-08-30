import {
  ChartLine,
  MapPin,
  Percent,
  Settings,
  Store,
  User,
} from "lucide-react";

// Tab order — Pato live 2026-08-05 (MESITA-900): place · promos ·
// performance · settings · admin. Reservations list + AI dial lines live
// inside Performance again (reverses MESITA-894's own-tab split). Channel
// config moved to Partnership (Pato live 2026-08-30) — Settings is people
// now, not rails. Admin stays last, admin-console-only.
/** Tabs shown in PlaceEditChrome. `soon: true` = parked: the tab renders
 *  disabled and its route serves a placeholder instead of the live section. */
export const PLACE_TAB_SECTIONS = [
  // decision: Pato live 2026-08-25 — Profile is the place (Store), Partner
  // is membership/promos (Percent). ShoppingBag is Orders; Handshake and
  // User stay off these two so Admin keeps the person glyph.
  { id: "place", label: "Profile", Icon: Store, soon: false },
  // decision: Pato live 2026-08-30 — tab label Partnership (route
  // `/promos` frozen; a rename never reaches the URL). The tab now holds
  // every capability the place offers: the subscription, Visit Rewards,
  // and the three rail boxes moved off Settings.
  { id: "promos", label: "Partnership", Icon: Percent, soon: false },
  // decision: Pato live 2026-08-09 — Performance is parked behind Soon. The
  // per-place feed reads as empty scaffolding on real places, so it's blocked
  // rather than shown half-true. The feed itself is untouched underneath —
  // flip this back to `false` to un-park it in one line.
  { id: "performance", label: "Performance", Icon: ChartLine, soon: true },
  { id: "settings", label: "Settings", Icon: Settings, soon: false },
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
