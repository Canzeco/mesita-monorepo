// The desktop rail's collapsed state rides a cookie rather than localStorage:
// the console shell is a server component, so reading it during render paints
// the rail at its final width on the first frame — no expand-then-snap flash,
// and no setState in an effect to reconcile it.
//
// Its own name, not admin's. Both consoles are served from *.mesita.ai and a
// shared cookie name would let one collapse the other.
export const SIDEBAR_COLLAPSED_COOKIE = "business_sidebar_collapsed";

// WHICH PLACE BOXES ARE OPEN (MESITA-1734), on a cookie for the same reason
// and it matters MORE here. Collapsed is one boolean and a wrong first frame
// costs a width; this is up to twelve rows of height, so reconciling it in an
// effect would jump the whole column on every console load.
//
// The value is place ids joined by ".". A place id is a uuid — hex and
// dashes — so the dot cannot appear inside one and needs no escaping. Cookies
// also forbid ";" and "," in a raw value, which is why neither is the
// separator.
export const RAIL_OPEN_PLACES_COOKIE = "business_rail_open_places";

// A hard ceiling on what the cookie may carry. Every request in the console
// pays for this header, and an operator who opens forty places should not be
// charged 1.5KB per navigation for a rail that cannot show forty boxes at
// once anyway. Oldest entries fall off first — see `serializeOpenPlaceIds`.
export const RAIL_OPEN_PLACES_MAX = 12;

const SEPARATOR = ".";

/** A place id, as this cookie is willing to store one.
 *
 *  The cookie is attacker-controllable — anyone can set any value in their own
 *  browser — and its contents are compared against ids from the server, never
 *  rendered or used to build a URL. Still filtered: an unbounded string from a
 *  cookie has no business reaching a Set that a render loop reads. */
function isPlausibleId(value: string): boolean {
  return value.length > 0 && value.length <= 64 && /^[A-Za-z0-9-]+$/.test(value);
}

/** Open place ids from a raw cookie value. Never throws; a malformed cookie
 *  yields an empty list rather than a broken rail. */
export function parseOpenPlaceIds(raw: string | null | undefined): string[] {
  if (typeof raw !== "string" || raw === "") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(SEPARATOR)) {
    if (!isPlausibleId(part) || seen.has(part)) continue;
    seen.add(part);
    out.push(part);
    if (out.length >= RAIL_OPEN_PLACES_MAX) break;
  }
  return out;
}

/** The cookie value for a set of open ids.
 *
 *  Takes the LAST `RAIL_OPEN_PLACES_MAX`, not the first: the caller appends
 *  newly-opened places, so the tail is the most recently opened and the head
 *  is the box the operator touched longest ago. Dropping the head keeps the
 *  places they are actually working in. */
export function serializeOpenPlaceIds(ids: Iterable<string>): string {
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!isPlausibleId(id) || seen.has(id)) continue;
    seen.add(id);
    kept.push(id);
  }
  return kept.slice(-RAIL_OPEN_PLACES_MAX).join(SEPARATOR);
}
