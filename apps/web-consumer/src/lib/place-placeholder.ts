// The card placeholder for a place with no photo to show (MESITA-2298).
//
// A Google-only result is ephemeral: Mesita holds no hero for it and never
// asks Google for one just because a card rendered, so its card shows the
// family's line icon (lib/family-icons.tsx; the emoji until MESITA-2478),
// deterministic from `family_keys`. A Google row with no
// resolvable family, and a Mesita place with no stored photo, show the
// name's initial. A Google-only row never shows a photo at all, whatever
// the wire carried.

import { PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";
import { firstInitial } from "@/lib/utils";

type PlaceholderPlace = {
  name: string;
  family_keys?: string[] | null;
  googleOnly?: boolean;
  from_google?: boolean;
  photos?: string[];
};

const GUEST_FAMILY_KEYS: ReadonlySet<string> = new Set(
  PLACE_FAMILIES.filter((f) => f.key !== "undefined").map((f) => f.key),
);

export function isGoogleOnlyPlace(place: {
  googleOnly?: boolean;
  from_google?: boolean;
}): boolean {
  return place.googleOnly === true || place.from_google === true;
}

/** The first guest family's key, or null when none resolves. */
export function firstGuestFamily(
  familyKeys: readonly string[] | null | undefined,
): FamilyKey | null {
  for (const key of familyKeys ?? []) {
    if (GUEST_FAMILY_KEYS.has(key)) return key as FamilyKey;
  }
  return null;
}

export type PlacePlaceholder =
  | { kind: "family"; family: FamilyKey }
  | { kind: "initial"; text: string };

/** What the card draws instead of a photo. */
export function placePlaceholder(place: PlaceholderPlace): PlacePlaceholder {
  if (isGoogleOnlyPlace(place)) {
    const family = firstGuestFamily(place.family_keys);
    if (family) return { kind: "family", family };
  }
  return { kind: "initial", text: firstInitial(place.name) };
}

/** The photo a card may show: never one for a Google-only row. */
export function cardPhoto(place: PlaceholderPlace): string | undefined {
  if (isGoogleOnlyPlace(place)) return undefined;
  return place.photos?.[0];
}
