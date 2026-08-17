// Place-list text matching for the Visit wallet's search field (MESITA-1071).
//
// Lives here, apart from the component, because it is the only part of the
// searchbar that can be WRONG in a way a screenshot would not catch — the
// component just renders whatever this returns.

/** The fields a row actually renders: its title and its subtitle. */
export type SearchablePlace = {
  name: string;
  zone?: string | null;
  category_label?: string | null;
  category?: string | null;
};

/**
 * Accent- and case-blind form. Spanish names carry diacritics that a guest
 * standing in a bar will not stop to type, so "cancun" has to find "Cancún".
 */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Narrows `places` to those matching every whitespace-separated token in
 * `query`, preserving input order. A blank or whitespace-only query matches
 * everything — an empty field is not a filter.
 *
 * Tokens are AND-ed so words narrow rather than widen: "zona sushi" means
 * both, not either. Each token may land in ANY field, so word order never
 * matters ("sushi zona" is the same query).
 *
 * Only the name, zone and category are searched — exactly what the row shows.
 * Matching on an invisible field returns hits that read as bugs.
 */
export function filterPlacesByQuery<T extends SearchablePlace>(
  places: readonly T[],
  query: string,
): readonly T[] {
  const tokens = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return places;

  return places.filter((place) => {
    const haystack = foldForSearch(
      [place.name, place.zone, place.category_label ?? place.category]
        .filter(Boolean)
        .join(" "),
    );
    return tokens.every((token) => haystack.includes(token));
  });
}
