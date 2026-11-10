// Input normalisation helpers shared by Edge Functions that accept
// user-typed strings (profile names, phones, free-form notes, etc.).

// Trim, length-cap, and reject empty/null. Used everywhere we'd
// otherwise repeat `String(...).trim()` plus a "did the user actually
// type anything" check.
export function clean(v: unknown, max = 256): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

/** A string trimmed, or null when it is not a string or trims to nothing. */
export function nonBlank(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

/** A string trimmed and capped at maxLen, or null when it is not a string or
 *  trims to nothing. Unlike clean(), a non-string is null, never String()-ed. */
export function optString(v: unknown, maxLen: number): string | null {
  const s = nonBlank(v);
  return s === null ? null : s.slice(0, maxLen);
}

/** A finite number as-is, or null (no coercion: "3" is null). */
export function finiteOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
