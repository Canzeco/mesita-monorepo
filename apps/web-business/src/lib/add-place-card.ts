// What ONE search result is, as one row (MESITA-1850).
//
// Pato, 2026-09-14: *"display if the place is already on mesita or if its not,
// and put the shitty button to claim/verify all the fucking workflow."*
//
// This used to map a lookup to one CEREMONY CARD that appeared only after you
// picked a prediction and waited for the lookup — three steps to learn one
// boolean. The mapping did not change; WHERE it renders did. It is a row's
// state now, resolved for every prediction as the results land, because
// `business-web-find-place` is a pure DB lookup on `google_place_id` — no
// Google call, no billing, so knowing costs nothing.
import type { LookupPlace, LookupResult } from "@/lib/api/verifications";

/** What the operator can do to this result, and what the row says about it.
 *
 *  THE SUBJECT IS THE READER (MESITA-1892). Three of these five said
 *  "organization" and meant "the thing that would end up holding it"; the
 *  place is the tenant now and claiming mints the CALLER's own owner row, so
 *  the same five states are about you. */
export type RowState =
  /** Not in the catalogue at all: create it, then it is yours. */
  | { kind: "create"; label: "Not on Mesita" }
  /** In the catalogue and unheld: claiming is one button. */
  | { kind: "claim"; label: "On Mesita"; place: LookupPlace }
  /** Already yours: the only thing left to do is open it. */
  | { kind: "open"; label: "You hold this"; placeId: string }
  /** You asked and are waiting. */
  | { kind: "pending"; label: "Your claim is pending"; placeId: string }
  /** Somebody else HOLDS it. NO BUTTON — see below. */
  | { kind: "taken"; label: "Claimed" };

/** The lookup, what you already hold, and nothing else.
 *
 *  A HELD PLACE GETS NO BUTTON (Pato's call, MESITA-1850). Every action the
 *  screen could offer here would 409 against a place somebody else holds, and
 *  an honest dead end beats a button that lies. The cost is real and named: an
 *  operator who IS the true owner of a place someone else grabbed has no path
 *  on this screen and has to reach ops. A contest flow is the upgrade when
 *  that first actually happens.
 */
export function rowStateForLookup(
  lookup: LookupResult,
  heldPlaceIds: ReadonlySet<string>,
): RowState {
  if (lookup.state === "not_in_mesita") {
    return { kind: "create", label: "Not on Mesita" };
  }
  // Held by YOU wins over every other state: whatever the catalogue thinks,
  // the operator's own place opens.
  if (heldPlaceIds.has(lookup.place.id)) {
    return { kind: "open", label: "You hold this", placeId: lookup.place.id };
  }
  if (lookup.state === "pending_by_me") {
    return { kind: "pending", label: "Your claim is pending", placeId: lookup.place.id };
  }
  // A PENDING CLAIM BY SOMEONE ELSE IS STILL CLAIMABLE — the prior law, kept
  // verbatim: "pending verification rows are still Add (unowned Mesita
  // places)". Nobody HOLDS it; somebody else merely asked. Whoever actually
  // completes the claim gets it, and hiding the button here would let a
  // pending request no one ever finishes park a place forever.
  if (
    lookup.state === "web_listed_unclaimed" ||
    lookup.state === "pending_by_other"
  ) {
    return { kind: "claim", label: "On Mesita", place: lookup.place };
  }
  // verified_partner: somebody HOLDS it.
  return { kind: "taken", label: "Claimed" };
}
