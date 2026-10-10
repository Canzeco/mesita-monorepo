// Admin's addresses for the shared place surface (MESITA-2086). The business
// console owns the full module — a catalogue, flat twins, a rail — and the
// shared files reach a handful of its names by alias. This is that handful,
// pointed at Manage › Single Place: `/manage-single/<id>/<tab|page>`.
//
// SAME NAMES, SAME SIGNATURES as web-business/src/lib/console-routes.ts, so
// a generated file compiles unchanged in both apps. Admin has no flat twins
// and no catalogue page of its own: `places` is the Find box, `placesNew` is
// Multiple Places (where Create lives), and `settings` is the operator's
// Account.
import { PLACE_BASE } from "@/lib/place-base";
import type { PlaceTab } from "@/lib/place-tabs";

export const SHELL_ROUTES = {
  root: PLACE_BASE,
  settings: "/account",
  places: PLACE_BASE,
  placesNew: "/manage-multiple",
} as const;

/** The segments beneath a place that are PAGES rather than views — the two
 *  the business rail draws as rows. Shared with `PLACE_TABS` by the strip. */
export const PLACE_PAGES = ["setup", "activity"] as const;
export type PlacePage = (typeof PLACE_PAGES)[number];

export const PLACE_PAGE_LABEL: Record<PlacePage, string> = {
  setup: "Setup",
  activity: "Activity",
};

/** Business's rail rows, kept so the shared products test (which pins that
 *  every row is a page row) reads the same table here. */
export type RailRow = { kind: "page"; target: PlacePage };
export const RAIL_ROWS: readonly RailRow[] = [
  { kind: "page", target: "setup" },
  { kind: "page", target: "activity" },
];

export function placePageHref(placeId: string, page: PlacePage): string {
  return `${PLACE_BASE}/${encodeURIComponent(placeId)}/${page}`;
}

/** The bare place address — a forwarder onto Profile, and where Stripe's
 *  stored `?connect=` return lands. */
export function placeRootHref(placeId: string): string {
  return `${PLACE_BASE}/${encodeURIComponent(placeId)}`;
}

export function placeHref(placeId: string): string {
  return `${PLACE_BASE}/${encodeURIComponent(placeId)}/profile`;
}

/** Find. Admin has no owned/public split to pre-filter. */
export function placesHref(): string {
  return SHELL_ROUTES.places;
}

export function placesNewHref(): string {
  return SHELL_ROUTES.placesNew;
}

/** Mesita Pay's controls — the Stripe account and the switch — a sub-step
 *  of Setup, same shape as in business. */
export function placePayHref(placeId: string): string {
  return `${PLACE_BASE}/${encodeURIComponent(placeId)}/pay/setup`;
}

const PLACE_PATH = new RegExp(
  `^${PLACE_BASE}/([^/]+)(?:/([^/]+))?(?:/([^/]+))?/?$`,
);

/** Which PAGE of a place a pathname is, or null when it is not one. A
 *  sub-step (`/pay/setup`) answers null here, as in business, and the bare
 *  place address answers null because it forwards to a VIEW. */
export function placePageFromPathname(pathname: string): PlacePage | null {
  const match = pathname.match(PLACE_PATH);
  if (!match) return null;
  const [, , second, third] = match;
  if (!second || third !== undefined) return null;
  return (PLACE_PAGES as readonly string[]).includes(second)
    ? (second as PlacePage)
    : null;
}

/** Which place a pathname is scoped to, through every depth, or null. */
export function placeIdFromPathname(pathname: string): string | null {
  const match = pathname.match(new RegExp(`^${PLACE_BASE}/([^/]+)(?:/.*)?$`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Re-attach a page's whole query string to another path — Stripe's stored
 *  return links carry `?connect=` and must survive the forward. */
export function withQuery(
  href: string,
  params: Record<string, string | string[] | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) for (const v of value) qs.append(key, v);
  }
  const query = qs.toString();
  return query ? `${href}?${query}` : href;
}

/** The view a place pathname shows is read by `placeTabFromPathname` in the
 *  shared lib/place-tabs; re-exported here so admin callers import one module. */
export type { PlaceTab };
