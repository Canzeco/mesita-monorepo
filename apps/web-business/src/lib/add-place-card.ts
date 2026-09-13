// Pure mapping: a find-place lookup + this org's held ids → one ceremony card.
// No OTP. Pending verification rows are still Add (unowned Mesita places).
import type { LookupPlace, LookupResult } from "@/lib/api/verifications";
import type { PlacePrediction } from "@/lib/api/place-search";

export type CeremonyCard =
  | { kind: "create"; prediction: PlacePrediction }
  | { kind: "add"; place: LookupPlace }
  | { kind: "open"; placeId: string; name: string }
  | { kind: "partner"; place: LookupPlace; ownerEmail: string | null };

export function cardForLookup(
  lookup: LookupResult,
  prediction: PlacePrediction,
  heldPlaceIds: ReadonlySet<string>,
): CeremonyCard {
  if (lookup.state === "not_in_mesita") {
    return { kind: "create", prediction };
  }
  if (lookup.place && heldPlaceIds.has(lookup.place.id)) {
    return { kind: "open", placeId: lookup.place.id, name: lookup.place.name };
  }
  if (lookup.state === "verified_partner") {
    return {
      kind: "partner",
      place: lookup.place,
      ownerEmail: lookup.owner.email,
    };
  }
  return { kind: "add", place: lookup.place };
}
