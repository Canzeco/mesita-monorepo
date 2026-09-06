// Route contract for the (shell) console — every href comes from here, and
// a test asserts each entry maps to a route file on disk.
//
// FIVE SCREENS (Pato, 2026-09-05): Account · Organization · Org Places ·
// Public Places · Place. Ascending scope, then the split that matters —
// the places this organization holds, and the pool it can claim from —
// and then the one address itself.
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
  pool: "/pool",
} as const;

/** Place — the fifth screen. Reached from either list. */
export function placeHref(placeId: string): string {
  return `${SHELL_ROUTES.places}/${encodeURIComponent(placeId)}`;
}

/** Is this pathname a Place screen? The nav needs to know, because
 *  `/places/<id>` starts with `/places` and would otherwise light up Org
 *  Places instead of Place. */
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
