// The place code (MESITA-3226; its own table since MESITA-3299): six digits
// an owner sets on Business › Payments and staff type at visit.mesita.ai.
// Only a hash is stored, bound to the place.

/** A place code: six digits, or null. Spaces a person typed do not count. */
export function readPlaceCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.replace(/\s/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** SHA-256 hex of the place code under its own prefix, so it can never match
 *  any other hash. Six digits are guessable from a leaked hash; the hash keeps
 *  the number out of plain sight, and the table is service-role only. */
export async function hashPlaceCode(placeId: string, code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`place-code:${placeId}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
