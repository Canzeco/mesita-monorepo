// Which place — the pure rules, with no React and no server imports, so the
// rail (client), the root resolver (server) and the tests all read the SAME
// function.
//
// THE PATH IS THE STATE (MESITA-1807). `/places/<id>/…` names the place; the
// rules below only fill in what the path does not say — which place the rail
// shows while you are on an address that names none, and where `/` lands.
//
// ONE SUBJECT NOW (MESITA-1892). There used to be two, and this file was
// `active-organization.ts`: it answered which organization, and then which of
// that organization's places. The organization is gone — a place carries its
// own partnership, its own Stripe account and its own members — so the
// portfolio is a flat list of places and `findHolder` has nothing left to
// search across.
//
// NEVER AN ORACLE. A place you are not a member of resolves exactly like one
// that does not exist: `findPlace` answers null for both, `business-web-get-place`
// answers 404 for both, and the fallbacks below never distinguish them. A rule
// that treated a foreign id differently from a nonexistent one would let
// anyone with a URL bar probe which places exist.
import type { PlaceRole } from "@/lib/api/console";

type PlaceLike = { id: string };

/** The place with this id, if the caller holds it. */
export function findPlace<T extends PlaceLike>(
  places: readonly T[],
  placeId: string | null | undefined,
): T | null {
  if (!placeId) return null;
  return places.find((p) => p.id === placeId) ?? null;
}

/** The place to assume when the path names none (Account, the catalogue, a
 *  pool place, `/`): the first candidate the caller actually holds — a place
 *  opened this session or remembered from the last — else the first place by
 *  name (the EF sorts them), else none.
 *
 *  It will pick for a caller who holds several, which is right HERE and wrong
 *  in the rail: see `pickPlaceNeverSilently` in lib/rail-scope.ts. */
export function pickPlace<T extends PlaceLike>(
  places: readonly T[],
  ...candidateIds: (string | null | undefined)[]
): T | null {
  for (const id of candidateIds) {
    const hit = findPlace(places, id);
    if (hit) return hit;
  }
  return places[0] ?? null;
}

/** Where `/` lands. */
export type Landing =
  | { kind: "place"; placeId: string }
  /** The caller holds nothing yet. The catalogue is the one next step: it is
   *  the pool, and Add place is on it. */
  | { kind: "catalog" };

/** The resolver behind `/` (Pato, D3 2026-09-12): the last place opened, else
 *  the first place held, else the catalogue — and ONLY from a SUCCESSFUL
 *  empty list; a failed read throws before this is ever called. */
export function resolveLanding<T extends PlaceLike>(input: {
  places: readonly T[];
  rememberedPlaceId: string | null | undefined;
}): Landing {
  const place = pickPlace(input.places, input.rememberedPlaceId);
  return place ? { kind: "place", placeId: place.id } : { kind: "catalog" };
}

/** Releasing is a write, and the strongest one on the list: it hands the place
 *  back to anyone. Owner only, mirroring `business-web-release-place`'s own
 *  guard, so the UI doesn't offer a button that will 403. */
export function canRelease(role: PlaceRole | null | undefined): boolean {
  return role === "owner";
}

/** Verifying is the proof half of the claim ceremony, so it carries the same
 *  law as the ownership moves it completes: owner only, matching
 *  business-web-verify-place's own guard. Named rather than borrowing
 *  canRelease, because the two answering the same today is a coincidence of
 *  the role table, not a rule — and a later split should not have to guess
 *  which callers meant which. */
export function canVerify(role: PlaceRole | null | undefined): boolean {
  return role === "owner";
}

// THERE IS NO `canClaim` OR `canAddPlace` ANY MORE (MESITA-1892), and the
// absence is the point rather than an omission.
//
// Both asked the same question — what is your role in the ORGANIZATION this
// place is about to join — and `claim_place(p_place_id, p_claimer)` has no
// such parameter: claiming mints the claimer's OWN owner row on the place.
// There is no membership to hold before you hold the place, so every
// signed-in manager may claim from the pool and the EF guards nothing else.
// A predicate that answered `true` for everyone would be a lock drawn on a
// door with no bolt in it.
//
// `alreadyHoldsPlace` went with them. "One place per organization"
// (MESITA-1879) was a cardinality read off `places.organization_id`, and that
// column is gone; a manager holds as many places as they have `place_members`
// rows, which is what the rail's `multi` mode has always rendered.
