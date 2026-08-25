// Google Place IDs are base64url-ish tokens (commonly 27 chars, length varies).
// Accept any [A-Za-z0-9_-] run of 18+ so IDs can be pulled out of CSV cells.

export const GOOGLE_PLACE_ID_RE = /^[A-Za-z0-9_-]{18,}$/;
const MESITA_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_GOOGLE_PLACE_IDS = 250;

export function isGooglePlaceId(token: string): boolean {
  return GOOGLE_PLACE_ID_RE.test(token) && !MESITA_UUID_RE.test(token);
}

export function parseGooglePlaceIds(
  text: string,
  cap = MAX_GOOGLE_PLACE_IDS,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of text.split(/[\s,]+/)) {
    const t = tok.trim();
    if (isGooglePlaceId(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
      if (out.length >= cap) break;
    }
  }
  return out;
}

/** Split a Google Search bar: Place-ID tokens vs leftover free text. */
export function splitSearchBarInput(raw: string): {
  placeIds: string[];
  query: string | null;
} {
  const tokens = raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const placeIds: string[] = [];
  const text: string[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    if (isGooglePlaceId(tok)) {
      if (!seen.has(tok)) {
        seen.add(tok);
        placeIds.push(tok);
      }
    } else {
      text.push(tok);
    }
  }
  const query = text.length > 0 ? text.join(" ") : null;
  return { placeIds, query };
}
