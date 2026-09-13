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
import {
  findHolder,
  findOrg,
  pickPlace,
  preferredOrg,
} from "@/lib/active-organization";
import { orgIdFromPathname, placeIdFromPathname } from "@/lib/console-routes";

/** What the rail needs of an organization. */
export type RailOrg = Pick<Organization, "id" | "name" | "myRole" | "places">;

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
};

export function resolveRailScope(input: {
  organizations: readonly RailOrg[];
  pathname: string;
  /** The last owned place opened this session (OpenPlaceProvider). */
  lastPlaceId?: string | null;
  /** The last place opened, from the cookie the layout read. */
  rememberedPlaceId?: string | null;
  /** The last organization visited, from the cookie the layout read. */
  rememberedOrgId?: string | null;
}): RailScope {
  const { organizations, pathname } = input;

  // A place route: the holder wins, whatever organization was remembered —
  // a pasted link to org A's place while org B was remembered shows A.
  const pathPlaceId = placeIdFromPathname(pathname);
  if (pathPlaceId) {
    const held = findHolder(organizations, pathPlaceId);
    if (held) {
      return {
        org: held.org,
        place: held.place,
        placeIsCurrent: true,
        foreignPlaceId: null,
      };
    }
    // Not in any of the caller's organizations: a pool place (or one the
    // place layout is about to 404). The Organization box falls back to the
    // remembered organization, whose Claim the pool place will want.
    return {
      org: preferredOrg(organizations, input.rememberedOrgId),
      place: null,
      placeIsCurrent: false,
      foreignPlaceId: pathPlaceId,
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
    place: pickPlace(org, input.lastPlaceId, input.rememberedPlaceId),
    placeIsCurrent: false,
    foreignPlaceId: null,
  };
}
