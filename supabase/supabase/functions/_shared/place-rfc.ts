// The Mexican RFC, as ONE rule (MESITA-1880, re-scoped by MESITA-1892).
//
// `places.rfc` carries the law: one RFC = one merchant, and since the
// organization layer was removed one merchant = one PLACE. Everything that has
// to agree on what an RFC IS — the place writer and the Connect prefill — reads
// it from here; until this module existed the regex lived in
// stripe-connect-prefill.ts, where the writer could not reach it. A rule the
// door and the wall state separately is a rule that drifts.
//
// The shape is also already load-bearing and SILENT: `rfcIfValid` drops a
// malformed RFC on the floor rather than failing, so an owner used to save
// one, see it stored, and never have it reach Stripe. The writers now refuse
// at the door (400) and the CHECK constraint backs them; prefill's fail-open
// stays exactly as it was, because by then the value cannot be malformed.
//
// UNIQUENESS is not enforced here — it cannot be, because two concurrent
// requests both read "no twin" and both insert. The partial unique index
// `places_rfc_unique` is the guarantee; `isDuplicateRfcError` below is how a
// writer turns that index's 23505 into a sentence an owner can act on.

/** Mexican RFC: persona moral 12 chars, persona física 13. The same shape the
 *  migration's `places_rfc_shape` CHECK states in SQL. Both must move
 *  together. */
export const MEXICO_RFC_RE = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

/**
 * What actually gets stored: trimmed and upper-cased, or null.
 *
 * Normalization is not cosmetic — it is what makes the unique index mean
 * anything. Without it `mesita010101abc` and `MESITA010101ABC ` are two
 * different rows to Postgres and one merchant to the SAT.
 *
 * Returns null for a non-string, an empty string, or whitespace: "no RFC" is
 * a legal state for a place that has not been paid yet.
 */
export function normalizeRfc(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const rfc = raw.trim().toUpperCase();
  return rfc || null;
}

/** Does a NORMALIZED value match the shape? Pass `normalizeRfc` output. */
export function isShapedRfc(rfc: string): boolean {
  return MEXICO_RFC_RE.test(rfc);
}

/** Normalize and validate in one step: `{ ok: true, rfc }` (rfc may be null,
 *  meaning "none given") or `{ ok: false }` when a value was given and is not
 *  an RFC. Every writer shares this so their 400s cannot disagree. */
export function readRfc(
  raw: unknown,
): { ok: true; rfc: string | null } | { ok: false } {
  const rfc = normalizeRfc(raw);
  if (rfc === null) return { ok: true, rfc: null };
  return isShapedRfc(rfc) ? { ok: true, rfc } : { ok: false };
}

/** The sentence an owner reads when the shape is wrong. */
export const RFC_SHAPE_ERROR =
  "That doesn't look like an RFC — 12 characters for a company, 13 for a person.";

/** The sentence an owner reads when the index refuses a twin. Names the rule
 *  rather than a remedy, because the remedy is now outside Mesita: one RFC is
 *  one place, and a second venue on the same tax ID is a conversation with
 *  support, not a form the owner can fill in differently. */
export const RFC_TAKEN_ERROR =
  "Another place already uses this RFC. One RFC is one place — contact support if this venue really shares a tax ID.";

/** Postgres unique_violation raised by `places_rfc_unique`.
 *
 *  Narrowed by constraint name on purpose: `places` carries several other
 *  unique indexes, and a writer that turns EVERY 23505 into "RFC taken" would
 *  lie about them. Falls back to matching the index name inside the message
 *  because supabase-js surfaces `details`/`message` more reliably than a
 *  structured constraint field. */
export function isDuplicateRfcError(
  err: { code?: string | null; message?: string | null; details?: string | null } | null,
): boolean {
  if (!err || err.code !== "23505") return false;
  const haystack = `${err.message ?? ""} ${err.details ?? ""}`;
  return haystack.includes("places_rfc_unique");
}
