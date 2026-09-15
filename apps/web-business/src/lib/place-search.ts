// WHEN A LIST STOPS BEING READABLE (MESITA-1803).
//
// The rail's place picker is a Radix menu over `org.places[]` — every place
// the active organization holds, already in hand from
// `business-web-list-organizations`, already sorted by name. Radix gives it
// typeahead and the content scrolls, so a keyboard operator is fine at any
// length. A MOUSE operator is not: past a certain count the menu is a 240px
// window onto a list that no longer fits, and scrolling is the only way
// through it.
//
// That count is the ONE number below. It lives here, exported, because the
// moment a second file retypes `8` the two can drift and the picker grows a
// field at one count while a test swears it grows at another. The rail reads
// `PLACE_SEARCH_MIN`; nobody writes the digit again (pinned in
// lib/place-search.test.ts and in lib/shell-chrome.test.ts).
//
// BELOW THE THRESHOLD NOTHING CHANGES — no field, no empty line, no keyboard
// handling. A search box over five rows is a control that costs a keystroke
// and saves none.

/** The number of places at which the picker grows a search field. Read it;
 *  never retype the number. One organization with this many places is the
 *  whole trigger — today the console holds one place per organization, so
 *  this is the franchise path arriving, not an everyday state. */
export const PLACE_SEARCH_MIN = 8;

/** Does a list this long earn a search field? */
export function placeSearchApplies(count: number): boolean {
  return count >= PLACE_SEARCH_MIN;
}

/** Fold a name to what a person typing at speed actually means: no case, no
 *  accents. Mesita's places are named in Spanish — an accent-sensitive filter
 *  answers nothing for "cafe" or "canon" and reads as a broken field. The
 *  range is the combining marks NFD splits an accented letter into. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** The rows that match, in the order they arrived. An empty query is not a
 *  filter — it returns the input untouched, the same array, so an open menu
 *  with nothing typed is the menu that was always there.
 *
 *  NO SORT. `business-web-list-organizations` already returns places sorted
 *  by name; a second ordering here would be a different list under the same
 *  name depending on whether the operator had typed. */
export function filterPlaces<T extends { name: string }>(
  places: readonly T[],
  query: string,
): readonly T[] {
  const q = fold(query.trim());
  if (q === "") return places;
  return places.filter((p) => fold(p.name).includes(q));
}
