// The rail's cookies. Cookies rather than localStorage, all three: the console
// shell is a server component, so reading them during render paints the rail
// at its final shape on the first frame — no expand-then-snap flash, no
// setState in an effect to reconcile it.
//
// Their own names, not admin's. Both consoles are served from *.mesita.ai and
// a shared cookie name would let one collapse the other.
export const SIDEBAR_COLLAPSED_COOKIE = "business_sidebar_collapsed";

// WHICH PLACE AND WHICH ORGANIZATION YOU WERE LAST IN (MESITA-1807). The rail
// shows the last place opened while you are on an organization page, and `/`
// lands on it after a reload; the organization is what Account, the create
// ceremony and a pool place fall back to. One id each. Within a session the
// OpenPlace context is the truth (a shared layout does not re-run on client
// navigations); these make the FIRST frame right.
export const RAIL_PLACE_COOKIE = "business_rail_place";
export const RAIL_ORG_COOKIE = "business_rail_org";

/** A year, path-wide, same-site: the shape every rail cookie is written in. */
export const RAIL_COOKIE_ATTRS = "path=/; max-age=31536000; samesite=lax";

/** An id, as these cookies are willing to store one.
 *
 *  A cookie is attacker-controllable — anyone can set any value in their own
 *  browser — and its contents are only ever compared against ids from the
 *  server, never rendered or used to build a URL on their own. Still
 *  filtered: an unbounded string from a cookie has no business reaching a
 *  render loop. */
export function isPlausibleId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 64 &&
    /^[A-Za-z0-9-]+$/.test(value)
  );
}

/** The id a raw cookie value carries, or null. Never throws. */
export function plausibleId(raw: string | null | undefined): string | null {
  return isPlausibleId(raw) ? raw : null;
}
