// Route contract for the (shell) console — every href comes from here, and
// a test asserts each entry maps to a route file on disk.
//
// FOUR SCREENS (Pato, 2026-09-07 — was five, 2026-09-05): Account ·
// Organization · Places · Place. Ascending scope, then the one address.
//
// Org Places and Public Places MERGED (MESITA-1614). The split was a filter
// wearing the costume of a screen: both listed places, both used the same row,
// and the only difference was whether `organization_id` was yours or null —
// which is Owned, a STATE. Pre-filtering it meant the states matrix could
// never show it varying, so the column was constant on both halves. One list
// with an Owned column says the same thing and lets you compare.
//
// `/pool` is a permanent redirect here — see next.config.ts.
//
// Place is the only screen that needs an id, so it is the only one absent
// from SHELL_ROUTES: `placeHref()` builds it. It nests UNDER Org Places
// (`/places/<id>`) because that is where you arrive from. The old `(console)`
// tree that used to squat on `/place/<id>` is deleted (MESITA-1564); that path
// is now a permanent redirect here — see `next.config.ts`.

export const SHELL_ROUTES = {
  account: "/account",
  organization: "/",
  places: "/places",
} as const;

// ── The rail's two Places children (MESITA-1710) ──────────────────────────
//
// `Org Places` and `Public Places` are back as LABELS, and they are still not
// screens. They are SAVED FILTERS on the one merged list: `?owned=org` and
// `?owned=public` against `/places`, which is why MESITA-1614 survives this
// change untouched — `/pool` is still a redirect, the Owned column is still
// the fact, and the parent row still shows both halves together so they can
// be compared.
//
// The split died because a horizontal bar pays for every item in WIDTH, so a
// pre-applied filter could not justify a whole screen. A vertical rail nests
// and costs nothing per row. The labels earn their place; the routes do not.

export const PLACES_OWNED = ["org", "public"] as const;
export type PlacesOwned = (typeof PLACES_OWNED)[number];

/** The list, optionally pre-filtered. No argument = both halves, which is the
 *  comparison view the merge exists to protect. */
export function placesHref(owned?: PlacesOwned | null): string {
  return owned ? `${SHELL_ROUTES.places}?owned=${owned}` : SHELL_ROUTES.places;
}

/** Read `?owned=` off a search param. Anything unrecognised is null — an
 *  unknown value must show the full list, never an empty one. */
export function ownedFromParam(value: unknown): PlacesOwned | null {
  return typeof value === "string" &&
    (PLACES_OWNED as readonly string[]).includes(value)
    ? (value as PlacesOwned)
    : null;
}

/** Place — the fourth screen. Reached from the list. */
export function placeHref(placeId: string): string {
  return `${SHELL_ROUTES.places}/${encodeURIComponent(placeId)}`;
}

/** Is this pathname a Place screen? The nav needs to know, because
 *  `/places/<id>` starts with `/places` and would otherwise light up Places
 *  instead of Place. */
export function placeIdFromPathname(pathname: string): string | null {
  // One OPTIONAL tab segment (MESITA-1537): /places/<id> and
  // /places/<id>/{capabilities,activity,admin} are all the Place screen,
  // so the nav must light Place on every one of them. Profile has no
  // segment of its own — it IS /places/<id>.
  const match = pathname.match(/^\/places\/([^/]+)(?:\/[^/]+)?\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Carry the active organization through a link. Organizations are real
 *  rows now, so there is no default to keep clean — the switcher writes
 *  this on every href once an org is selected. */
export function withOrg(href: string, organizationId: string | null): string {
  if (!organizationId) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}org=${encodeURIComponent(organizationId)}`;
}
