// What the rail is scoped to — ONE pure function, read off the pathname.
//
// The rail is rendered by `(shell)/layout.tsx`, which sits ABOVE
// `places/[id]` and therefore knows nothing about it. It does not need to: the
// pathname says which place, the viewer payload the shell already holds says
// what the caller holds, and this function turns the two into the rail's
// subject. Client-side it runs from `usePathname`; nothing is re-fetched and
// nothing is published upward except the two things the pathname cannot carry
// — a place's name when it is not in the viewer's own portfolio, and the last
// place opened this session.
//
// ONE SUBJECT (MESITA-1892). It used to resolve two — an organization and one
// of its places — and `findHolder` searched every organization for a pasted
// place id. The layer is gone: the portfolio is a flat list of places, so the
// search is a lookup and the fallback has one candidate instead of two.
//
// WHY `lastPlaceId` COMES FROM THE SESSION, NOT ONLY A COOKIE. A shared layout
// does not re-run on client navigations (Next 16), so a cookie handed down by
// the layout is right on the first frame only. `OpenPlaceProvider` keeps the
// last owned place it saw for the life of the session, and that beats the
// cookie here; the cookie is what makes the FIRST frame right after a reload.
//
// Keep this file free of server imports: the rail is a client component.
import type { ConsolePlace } from "@/lib/api/console";
import { findPlace } from "@/lib/active-place";
import {
  SHELL_ROUTES,
  flatPlacePageFromPathname,
  flatViewFromPathname,
  placeIdFromPathname,
} from "@/lib/console-routes";

/** What the rail needs of a place — plus the two tier flags (MESITA-1867,
 *  place-scoped since MESITA-1892). They are not the rail's to paint; they
 *  ride this list because the shell already holds it on every route, and a
 *  place's product ladder reads them off `RailScopeContext` instead of
 *  spending a second console-viewer call per navigation. Both optional on the
 *  payload, so absent stays "unknown", never false. */
export type RailPlace = Pick<
  ConsolePlace,
  "id" | "name" | "photoUrl" | "myRole" | "partnered" | "mesitaPayEnabled"
>;

/** WHAT SHAPE THE CONSOLE IS IN (MESITA-1879) — the one discriminant the rail
 *  switches on, and the reason it is four values rather than a boolean.
 *
 *  A boolean `soloPlace` would be false at zero places AND at two, and false
 *  again when the places read simply FAILED. `lib/products.ts` already refuses
 *  to conflate the last two ("null means the read FAILED. An empty array means
 *  the caller holds no place — two different facts"), and it refuses for the
 *  same reason the rail must: a failed read rendered as "you hold several
 *  places" tells an operator something about their business that is not true.
 *
 *    unknown  the read failed. A retry, never a count, never "add one"
 *             (MESITA-1793's law).
 *    zero     a successful read of no places. The console's first-run shape.
 *    solo     exactly one. THE shape this console is built for — the flat rail.
 *    multi    two or more. The console does not pick one; it shows the list.
 */
export type RailMode = "unknown" | "zero" | "solo" | "multi";

export type RailScope = {
  /** The place the rail is about. Null when the caller holds none, and when
   *  they hold several and nothing on screen names one. */
  place: RailPlace | null;
  /** True when `place` is the place the pathname is on. */
  placeIsCurrent: boolean;
  /** The pathname's place when the caller holds no membership on it: a pool
   *  place opened from the catalogue. Its name arrives by publish. */
  foreignPlaceId: string | null;
  /** The shape of the console. See `RailMode`. */
  mode: RailMode;
};

/** How many places the caller holds, and whether we actually know.
 *
 *  `viewerError` is NOT re-derived here: `(shell)/layout.tsx` already computes
 *  it when `apiConsoleViewer` throws, and already hands it to the chrome. It
 *  travels one level further rather than becoming a second mechanism, which is
 *  why `places` stays a plain array and no caller's signature changes. */
function railMode(places: readonly RailPlace[], viewerError: boolean): RailMode {
  if (viewerError) return "unknown";
  const n = places.length;
  return n === 0 ? "zero" : n === 1 ? "solo" : "multi";
}

/** The place to show when the PATHNAME names none.
 *
 *  It differs from `pickPlace` in exactly one case, and that case is the whole
 *  point: a caller holding several places falls through to `places[0]` there,
 *  which is a place the operator never chose. On Profile that is an edit
 *  against the wrong venue, and nothing on screen says so. Here the candidates
 *  still win when there is one — a place opened this session or remembered
 *  from the last is a CHOICE, not a guess — and with no candidate at all, a
 *  multi-place portfolio gets null and the console answers with its list. */
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
  /** The last owned place opened this session (OpenPlaceProvider). */
  lastPlaceId?: string | null;
  /** The last place opened, from the cookie the layout read. */
  rememberedPlaceId?: string | null;
  /** The places read FAILED. Computed once in `(shell)/layout.tsx` and passed
   *  down; never re-derived from an empty array, because an empty array is a
   *  different fact (MESITA-1879). */
  viewerError?: boolean;
}): RailScope {
  const { places, pathname } = input;
  const failed = input.viewerError === true;

  // A FLAT address (/profile, /settings, … — MESITA-1832): it names no place,
  // so the place is the one the (place) layout published this session, else
  // the remembered one. A published place the caller holds no membership on is
  // a pool place, selected as foreign.
  // THE PAGE TWINS AND `/settings` ANSWER HERE TOO (MESITA-1974). `/setup` and
  // `/activity` name no place either, and `/settings` names none by design —
  // it is the person's address as much as the place's. Without them all three
  // fell through to the catch-all below, which PICKS a place rather than
  // remembering one, and picking is the thing this branch exists to prevent.
  if (
    flatViewFromPathname(pathname) ||
    flatPlacePageFromPathname(pathname) ||
    pathname === SHELL_ROUTES.settings
  ) {
    const candidate = input.lastPlaceId ?? input.rememberedPlaceId ?? null;
    const held = findPlace(places, candidate);
    if (held) {
      return {
        place: held,
        placeIsCurrent: true,
        foreignPlaceId: null,
        mode: railMode(places, failed),
      };
    }
    if (input.lastPlaceId) {
      return {
        place: null,
        placeIsCurrent: false,
        foreignPlaceId: input.lastPlaceId,
        mode: railMode(places, failed),
      };
    }
    // NEVER `pickPlace` HERE. A flat name is the one address that names no
    // place at all, so this is exactly where a caller holding several would
    // get one chosen for them — and `/profile` is a form.
    const place = pickPlaceNeverSilently(places);
    return {
      place,
      placeIsCurrent: place !== null,
      foreignPlaceId: null,
      mode: railMode(places, failed),
    };
  }

  // An address that names a place — its own view, one of its pages, or a
  // forwarder in flight. The pathname wins over everything remembered: a
  // pasted link to one place while another was remembered shows the pasted
  // one.
  const pathPlaceId = placeIdFromPathname(pathname);
  if (pathPlaceId) {
    const held = findPlace(places, pathPlaceId);
    if (held) {
      return {
        place: held,
        placeIsCurrent: true,
        foreignPlaceId: null,
        mode: railMode(places, failed),
      };
    }
    // Not one of the caller's: a pool place (or one the place layout is about
    // to 404).
    return {
      place: null,
      placeIsCurrent: false,
      foreignPlaceId: pathPlaceId,
      mode: railMode(places, failed),
    };
  }

  // Every other address (Account, the catalogue, the ceremony) falls back to
  // the place the operator was last in, so the rail's rows stay one click from
  // where they were working.
  return {
    place: pickPlaceNeverSilently(
      places,
      input.lastPlaceId,
      input.rememberedPlaceId,
    ),
    placeIsCurrent: false,
    foreignPlaceId: null,
    mode: railMode(places, failed),
  };
}
