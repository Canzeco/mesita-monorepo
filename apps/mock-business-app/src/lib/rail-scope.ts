// What the rail is scoped to — ONE pure function, read off the pathname.
//
// Snapshot of `apps/web-business/src/lib/rail-scope.ts`, minus the cookie: this
// app has no request to read one from, and `MockStore` keeps the last place
// opened for the life of the session, which is what the cookie was for.
//
// The four modes are the point of this file, and the reason they are four
// values rather than a boolean: a boolean `soloPlace` would be false at zero
// places AND at two, and false again when the read simply FAILED. A failed read
// rendered as "you hold several places" tells an operator something about their
// business that is not true.
import type { MockPlace } from "@/mock/types";
import { flatViewFromPathname, placeIdFromPathname } from "@/lib/console-routes";

export type RailPlace = Pick<
  MockPlace,
  "id" | "name" | "photoUrl" | "myRole" | "partnered" | "pay"
>;

/**
 *   unknown  the read failed. A retry, never a count, never "add one".
 *   zero     a successful read of no places. The console's first-run shape.
 *   solo     exactly one. THE shape this console is built for — the flat rail.
 *   multi    two or more. The console does not pick one; it shows the list.
 */
export type RailMode = "unknown" | "zero" | "solo" | "multi";

export type RailScope = {
  /** The place the rail is about. Null when the caller holds none, and when
   *  they hold several and nothing on screen names one. */
  place: RailPlace | null;
  /** True when `place` is the place the pathname is on. */
  placeIsCurrent: boolean;
  /** The pathname's place when the caller holds no membership on it: a pool
   *  place opened from the catalogue. */
  foreignPlaceId: string | null;
  mode: RailMode;
};

export function findPlace(
  places: readonly RailPlace[],
  id: string | null | undefined,
): RailPlace | null {
  if (!id) return null;
  return places.find((p) => p.id === id) ?? null;
}

function railMode(places: readonly RailPlace[], viewerError: boolean): RailMode {
  if (viewerError) return "unknown";
  const n = places.length;
  return n === 0 ? "zero" : n === 1 ? "solo" : "multi";
}

/** The place to show when the PATHNAME names none.
 *
 *  A caller holding SEVERAL places gets null rather than `places[0]`, and that
 *  is the whole difference: `places[0]` is a place the operator never chose,
 *  and on Profile that is an edit against the wrong venue with nothing on
 *  screen saying so. A place opened this session is a CHOICE and still wins. */
function pickPlaceNeverSilently(
  places: readonly RailPlace[],
  ...candidateIds: (string | null | undefined)[]
): RailPlace | null {
  for (const id of candidateIds) {
    const hit = findPlace(places, id);
    if (hit) return hit;
  }
  return places.length === 1 ? places[0] : null;
}

export function resolveRailScope(input: {
  places: readonly RailPlace[];
  pathname: string;
  lastPlaceId?: string | null;
  viewerError?: boolean;
}): RailScope {
  const { places, pathname } = input;
  const failed = input.viewerError === true;
  const mode = railMode(places, failed);

  // A FLAT address (/profile, /settings, …): it names no place, so the place is
  // the one opened this session. NEVER `pickPlace` here — a flat name is the
  // one address that names no place at all, so this is exactly where a caller
  // holding several would get one chosen for them, and `/profile` is a form.
  if (flatViewFromPathname(pathname) || pathname === "/settings" || pathname === "/products" || pathname === "/customers" || pathname === "/activity") {
    const held = findPlace(places, input.lastPlaceId);
    if (held) {
      return { place: held, placeIsCurrent: true, foreignPlaceId: null, mode };
    }
    if (input.lastPlaceId) {
      return {
        place: null,
        placeIsCurrent: false,
        foreignPlaceId: input.lastPlaceId,
        mode,
      };
    }
    const place = pickPlaceNeverSilently(places);
    return { place, placeIsCurrent: place !== null, foreignPlaceId: null, mode };
  }

  // An address that NAMES a place wins over everything remembered: a pasted
  // link to one place while another was remembered shows the pasted one.
  const pathPlaceId = placeIdFromPathname(pathname);
  if (pathPlaceId) {
    const held = findPlace(places, pathPlaceId);
    if (held) {
      return { place: held, placeIsCurrent: true, foreignPlaceId: null, mode };
    }
    return {
      place: null,
      placeIsCurrent: false,
      foreignPlaceId: pathPlaceId,
      mode,
    };
  }

  // Everything else — Account, the catalogue, the ceremony.
  return {
    place: pickPlaceNeverSilently(places, input.lastPlaceId),
    placeIsCurrent: false,
    foreignPlaceId: null,
    mode,
  };
}
