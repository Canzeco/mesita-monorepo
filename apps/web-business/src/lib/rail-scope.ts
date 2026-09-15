// What the rail is scoped to — ONE pure function, read off the pathname.
//
// The rail is rendered by `(shell)/layout.tsx`, which sits ABOVE
// `orgs/[orgId]` and `places/[id]` and therefore knows neither. It does not
// need to: the pathname says which organization or which place, the viewer
// payload the shell already holds says what they contain, and this function
// turns the two into the three boxes. Client-side it runs from `usePathname`;
// nothing is re-fetched and nothing is published upward except the two
// things the pathname cannot carry — a place's name when it is not in the
// viewer's own portfolio, and the last place opened this session.
//
// WHY `lastPlaceId` COMES FROM THE SESSION, NOT ONLY A COOKIE. A shared layout
// does not re-run on client navigations (Next 16), so a cookie handed down by
// the layout is right on the first frame only. `OpenPlaceProvider` keeps the
// last owned place it saw for the life of the session, and that beats the
// cookie here; the cookie is what makes the FIRST frame right after a reload.
//
// Keep this file free of server imports: the rail is a client component.
import type { Organization, RailPlace } from "@/lib/api/organizations";
import { findHolder, findOrg, preferredOrg } from "@/lib/active-organization";
import { flatViewFromPathname, orgIdFromPathname, placeIdFromPathname } from "@/lib/console-routes";

/** What the rail needs of an organization — plus the two org-level tier
 *  flags (MESITA-1867). They are not the rail's to paint; they ride this
 *  list because the shell already holds it on every route, and a place's
 *  Rewards/Capabilities ladder reads them off `RailScopeContext` instead of
 *  spending a second `business-web-list-organizations` call per navigation.
 *  Both optional on the payload, so absent stays "unknown", never false. */
export type RailOrg = Pick<
  Organization,
  "id" | "name" | "myRole" | "places" | "partnered" | "mesitaPayEnabled"
>;

/** WHAT SHAPE THE CONSOLE IS IN (MESITA-1879) — the one discriminant the rail
 *  switches on, and the reason it is four values rather than a boolean.
 *
 *  A boolean `soloPlace` would be false at zero places AND at two, and false
 *  again when the organizations read simply FAILED. `lib/products.ts:139`
 *  already refuses to conflate the last two ("null means the read FAILED. An
 *  empty array means the organization holds no place — two different facts"),
 *  and it refuses for the same reason the rail must: a failed read rendered as
 *  "you hold several places" tells an operator something about their business
 *  that is not true.
 *
 *    unknown  the read failed. A retry, never a count, never "create one"
 *             (MESITA-1793's law).
 *    zero     a successful read of no places. The console's first-run shape.
 *    solo     exactly one. THE shape this console is built for — the flat rail.
 *    multi    two or more. The console does not pick one; it shows the list.
 */
export type RailMode = "unknown" | "zero" | "solo" | "multi";

export type RailScope = {
  /** The organization the rail is showing. Null only with no membership. */
  org: RailOrg | null;
  /** The place the Place box shows, held by `org`. Null when it holds none. */
  place: RailPlace | null;
  /** True when `place` is the place the pathname is on. */
  placeIsCurrent: boolean;
  /** The pathname's place when it is in NONE of the viewer's organizations:
   *  a pool place opened from the list. Its name arrives by publish. */
  foreignPlaceId: string | null;
  /** The shape of the console. See `RailMode`. */
  mode: RailMode;
};

/** How many places the organization holds, and whether we actually know.
 *
 *  `viewerError` is NOT re-derived here: `(shell)/layout.tsx` already computes
 *  it when `apiConsoleViewer` throws, and already hands it to the chrome. It
 *  travels one level further rather than becoming a second mechanism, which is
 *  why `organizations` stays a plain array and no caller's signature changes. */
function railMode(org: RailOrg | null, viewerError: boolean): RailMode {
  if (viewerError) return "unknown";
  const n = org?.places.length ?? 0;
  return n === 0 ? "zero" : n === 1 ? "solo" : "multi";
}

/** The place to show when the PATHNAME names none.
 *
 *  It differs from `pickPlace` in exactly one case, and that case is the whole
 *  point: an organization holding several places falls through to `places[0]`
 *  there, which is a place the operator never chose. On Profile that is an
 *  edit against the wrong venue, and nothing on screen says so. Here the
 *  candidates still win when there is one — a place opened this session or
 *  remembered from the last is a CHOICE, not a guess — and with no candidate
 *  at all, a multi-place organization gets null and the console answers with
 *  its list. */
function pickPlaceNeverSilently(
  org: RailOrg | null,
  ...candidateIds: (string | null | undefined)[]
): RailPlace | null {
  if (!org) return null;
  for (const id of candidateIds) {
    if (!id) continue;
    const hit = org.places.find((p) => p.id === id);
    if (hit) return hit;
  }
  return org.places.length === 1 ? org.places[0] : null;
}

export function resolveRailScope(input: {
  organizations: readonly RailOrg[];
  pathname: string;
  /** The last owned place opened this session (OpenPlaceProvider). */
  lastPlaceId?: string | null;
  /** The last place opened, from the cookie the layout read. */
  rememberedPlaceId?: string | null;
  /** The last organization visited, from the cookie the layout read. */
  rememberedOrgId?: string | null;
  /** The organizations read FAILED. Computed once in `(shell)/layout.tsx`
   *  and passed down; never re-derived from an empty array, because an empty
   *  array is a different fact (MESITA-1879). */
  viewerError?: boolean;
}): RailScope {
  const { organizations, pathname } = input;
  const failed = input.viewerError === true;

  // A FLAT place view (/profile, /reviews, … — MESITA-1832): the address
  // names no place, so the place is the one the (place) layout published
  // this session, else the remembered one — its holder wins, whatever
  // organization was remembered. A published place no organization of mine
  // holds is a pool place, selected as foreign.
  if (flatViewFromPathname(pathname)) {
    const candidate = input.lastPlaceId ?? input.rememberedPlaceId ?? null;
    const held = findHolder(organizations, candidate);
    if (held) {
      return {
        org: held.org,
        place: held.place,
        placeIsCurrent: true,
        foreignPlaceId: null,
        mode: railMode(held.org, failed),
      };
    }
    const org = preferredOrg(organizations, input.rememberedOrgId);
    if (input.lastPlaceId) {
      return {
        org,
        place: null,
        placeIsCurrent: false,
        foreignPlaceId: input.lastPlaceId,
        mode: railMode(org, failed),
      };
    }
    // NEVER `pickPlace` HERE. A flat name is the one address that names no
    // place at all, so this is exactly where an organization holding several
    // would get one chosen for it — and `/profile` is a form.
    const place = pickPlaceNeverSilently(org);
    return {
      org,
      place,
      placeIsCurrent: place !== null,
      foreignPlaceId: null,
      mode: railMode(org, failed),
    };
  }

  // A place route (a forwarder in flight): the holder wins, whatever
  // organization was remembered — a pasted link to org A's place while org B
  // was remembered shows A.
  const pathPlaceId = placeIdFromPathname(pathname);
  if (pathPlaceId) {
    const held = findHolder(organizations, pathPlaceId);
    if (held) {
      return {
        org: held.org,
        place: held.place,
        placeIsCurrent: true,
        foreignPlaceId: null,
        mode: railMode(held.org, failed),
      };
    }
    // Not in any of the caller's organizations: a pool place (or one the
    // place layout is about to 404). The Organization box falls back to the
    // remembered organization, whose Claim the pool place will want.
    const poolOrg = preferredOrg(organizations, input.rememberedOrgId);
    return {
      org: poolOrg,
      place: null,
      placeIsCurrent: false,
      foreignPlaceId: pathPlaceId,
      mode: railMode(poolOrg, failed),
    };
  }

  // An organization route names the organization; every other route falls
  // back to the remembered one. The place shown is the one the operator was
  // last in, so Payments is one click from the place and back.
  const org =
    findOrg(organizations, orgIdFromPathname(pathname)) ??
    preferredOrg(organizations, input.rememberedOrgId);
  return {
    org,
    place: pickPlaceNeverSilently(
      org,
      input.lastPlaceId,
      input.rememberedPlaceId,
    ),
    placeIsCurrent: false,
    foreignPlaceId: null,
    mode: railMode(org, failed),
  };
}
