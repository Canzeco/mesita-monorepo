// The card placeholder for a place with no photo to show (MESITA-2298).
//
// A Google-only result is ephemeral: Mesita holds no hero for it and never
// asks Google for one just because a card rendered, so its card shows the
// family emoji, deterministic from `family_keys`. A Google row with no
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

const EMOJI_BY_KEY: ReadonlyMap<string, string> = new Map(
  PLACE_FAMILIES.filter((f) => f.key !== "undefined").map((f) => [
    f.key,
    f.emoji,
  ]),
);

export function isGoogleOnlyPlace(place: {
  googleOnly?: boolean;
  from_google?: boolean;
}): boolean {
  return place.googleOnly === true || place.from_google === true;
}

/** The first guest family's emoji, or null when none resolves. */
export function familyEmoji(
  familyKeys: readonly string[] | null | undefined,
): string | null {
  for (const key of familyKeys ?? []) {
    const emoji = EMOJI_BY_KEY.get(key as FamilyKey);
    if (emoji) return emoji;
  }
  return null;
}

export type PlacePlaceholder =
  | { kind: "emoji"; text: string }
  | { kind: "initial"; text: string };

/** What the card draws instead of a photo. */
export function placePlaceholder(place: PlaceholderPlace): PlacePlaceholder {
  if (isGoogleOnlyPlace(place)) {
    const emoji = familyEmoji(place.family_keys);
    if (emoji) return { kind: "emoji", text: emoji };
  }
  return { kind: "initial", text: firstInitial(place.name) };
}

/** The photo a card may show: never one for a Google-only row. */
export function cardPhoto(place: PlaceholderPlace): string | undefined {
  if (isGoogleOnlyPlace(place)) return undefined;
  return place.photos?.[0];
}
