// THE PLACE'S INSTAGRAM (MESITA-4291). Story's story mentions it, and a
// place without one sells no Story (Pato, 2026-11-17: "THE PLACE MUST HAVE
// INSTAGRAM FOR THE STORY OFFERS TO BE VALID"). Pure; no imports, so the
// voucher, list and story modules all read the one rule.

/** The place's Instagram username from its stored URL, or null. */
export function instagramHandleOfUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const m = url.trim().match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i);
  return m ? m[1].toLowerCase() : null;
}
