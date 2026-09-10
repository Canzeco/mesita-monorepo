// _shared/config-coerce.ts — reading ONE value out of an admin config blob.
//
// Every section on `app_config` is jsonb the console sent, so a normalizer
// meets whatever the client last wrote: a number that arrived as a string, a
// key an older console never sent, a knob someone hand-edited past its range.
// The house rule for a single value is the same in all of them — never throw,
// never persist nonsense, fall back to the launch default and clamp what
// survives — and it was written out five times.
//
// This is the VALUE rule only. It says nothing about how a section is read or
// written: config-section-base.ts records why those are NOT one function ten
// times (four sections carry real per-section validation), and that stays
// true. A shared clamp is not a shared handler.
//
// A leaf with no imports, so a normalizer costs nothing to pull it in.

/**
 * A finite number inside [min, max], else `fallback`. Numeric strings are
 * accepted (`Number(raw)`) because a console input can arrive either way.
 *
 * Two behaviours worth knowing, both inherited verbatim from the five copies
 * this replaces — neither is changed here, because a normalizer is what the
 * saved rows were written through:
 *
 * 1. An out-of-range number is CLAMPED to the nearest bound, not dropped to
 *    `fallback`. A saved 500 on a knob that caps at 100 means "as high as it
 *    goes", and turning that into the default would quietly undo an edit.
 *
 * 2. `Number()` is what decides "is this a number", and `Number(null)`,
 *    `Number("")` and `Number([])` are all 0 — so an explicit JSON `null` on a
 *    key reads as 0 (then clamped to `min`), NOT as `fallback`. Only
 *    `undefined` — a key the blob does not carry at all — reaches `fallback`.
 *    In practice normalizers index a missing key and get `undefined`, so the
 *    default path is the common one; a key stored as a literal `null` is the
 *    case to be aware of.
 */
export function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * A real boolean, else `fallback`. Deliberately strict — "false", 0 and "" are
 * NOT read as false: a missing knob and a knob explicitly turned off must not
 * be the same fact, or a section that gains a key would silently default every
 * older row to off.
 */
export function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

/**
 * The blob itself, as something you can index — `{}` for anything that is not
 * a plain object.
 *
 * Arrays are rejected on purpose: a section that arrives as `[]` (an older
 * console, a hand-edited row) would otherwise index cleanly and read every key
 * as undefined, so each knob would take its default and the save would look
 * successful. `{}` reaches the same defaults, but says why.
 */
export function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
}
