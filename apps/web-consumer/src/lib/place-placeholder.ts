// The card placeholder for a place with no photo to show (MESITA-2298).
//
// A Google-only result is ephemeral: Mesita holds no hero for it and never
// asks Google for one just because a card rendered, so its card shows a
// placeholder. So does a Mesita place with no stored photo. The placeholder
// is the category's own emoji (MESITA-2667, Pato: "instead of displaying that
// shitty thing display the emoji of the category"): `category` is the Google
// type on both kinds of row, and `@mesita/place-profile` holds one emoji per
// type. Not the family's mark: families keep their own emoji and line icons
// (MESITA-2478). A category Google's table does not hold shows the name's
// initial. A Google-only row never shows a photo at all, whatever the wire
// carried.

import { googleTypeEmoji } from "@mesita/place-profile";
import { firstInitial } from "@/lib/utils";

type PlaceholderPlace = {
  name: string;
  category?: string | null;
  googleOnly?: boolean;
  from_google?: boolean;
  photos?: string[];
};

export function isGoogleOnlyPlace(place: {
  googleOnly?: boolean;
  from_google?: boolean;
}): boolean {
  return place.googleOnly === true || place.from_google === true;
}

export type PlacePlaceholder =
  | { kind: "emoji"; emoji: string }
  | { kind: "initial"; text: string };

/** What the card draws instead of a photo. */
export function placePlaceholder(place: PlaceholderPlace): PlacePlaceholder {
  const emoji = googleTypeEmoji(place.category);
  if (emoji) return { kind: "emoji", emoji };
  return { kind: "initial", text: firstInitial(place.name) };
}

/** The photo a card may show: never one for a Google-only row. */
export function cardPhoto(place: PlaceholderPlace): string | undefined {
  if (isGoogleOnlyPlace(place)) return undefined;
  return place.photos?.[0];
}
