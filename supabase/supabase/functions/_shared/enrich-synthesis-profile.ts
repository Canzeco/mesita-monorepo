import { ENRICH_DESCRIPTION_MAX } from "./enrich-config.ts";
import { PlaceDetailsSchema, PopularTimesSchema } from "./place-jsonb-schemas.ts";

export type ProfileResult = {
  zone?: string | null;
  city?: string | null;
  established_year?: number | null;
  executive_chef?: string | null;
  editorial_summary?: string | null;
  /** Canonical Presentation — always English (Mesita core language). */
  description?: string | null;
  /**
   * Clean Mesita display name (§8.4 v3): the Google label stripped of chain
   * suffixes, slogans, and city tags; proper case. NOT applied by
   * applyProfileToUpdate — only the mesita-name-door may land it (gate D2).
   */
  mesita_name?: string | null;
  details?: Record<string, unknown> | null;
  popular_times?: unknown[] | null;
};

// Coerce an LLM-produced value to usable text: a string is trimmed; an array
// of strings becomes paragraphs; a plain object's string values (a shape
// gpt-4o-mini actually emits for the description, e.g. {intro, ambiente, cocina})
// become paragraphs too, one level deep. Anything else is dropped.
// json_object mode only *describes* the schema — the model can and does
// return off-type fields, and one bad field must never throw the stage.
export function asProfileText(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  const parts: string[] = [];
  if (Array.isArray(v)) {
    for (const x of v) {
      if (typeof x === "string" && x.trim()) parts.push(x.trim());
      else if (x && typeof x === "object") {
        for (const y of Object.values(x)) {
          if (typeof y === "string" && y.trim()) parts.push(y.trim());
        }
      }
    }
  } else if (v && typeof v === "object") {
    for (const y of Object.values(v)) {
      if (typeof y === "string" && y.trim()) parts.push(y.trim());
    }
  }
  return parts.length > 0 ? parts.join("\n\n") : null;
}

// Ensure the Presentation is readable paragraphs, not one mambo-jumbo block.
// - Collapse runs of whitespace inside a paragraph.
// - Normalize any mix of single/double newlines into blank-line breaks.
// - If the model still returned one wall of text, split on sentence ends into
//   ~2–4 sentence paragraphs (skips short blurbs that don't need splitting).
export function formatDescriptionParagraphs(raw: string): string {
  const trimmed = raw.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return "";

  // Prefer blank-line breaks; if the model only used single newlines, those
  // become paragraphs too. Collapse soft wraps inside a paragraph last.
  let paragraphs = trimmed.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 1 && /\n/.test(paragraphs[0])) {
    paragraphs = paragraphs[0].split(/\n+/).map((p) => p.trim()).filter(Boolean);
  }
  paragraphs = paragraphs.map((p) =>
    p.replace(/[ \t]*\n[ \t]*/g, " ").replace(/[ \t]+/g, " ").trim()
  ).filter(Boolean);

  // Still one block and long enough → sentence-pack into paragraphs.
  if (paragraphs.length === 1 && paragraphs[0].length > 280) {
    const sentences = paragraphs[0]
      .match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [paragraphs[0]];
    if (sentences.length >= 3) {
      const packed: string[] = [];
      for (let i = 0; i < sentences.length; i += 3) {
        packed.push(sentences.slice(i, i + 3).join(" "));
      }
      paragraphs = packed;
    }
  }

  return paragraphs.join("\n\n");
}

// Apply the synthesized profile onto the place update object (mutates it).
// Only sets a field when synthesis actually produced a usable value.
export function applyProfileToUpdate(
  update: Record<string, unknown>,
  parsed: ProfileResult,
): void {
  // Zone + city are Google-native (Product Rules §A): the Google spine seeds
  // them onto `update` before synthesis runs. Synthesis is only a FALLBACK for
  // when Google carried none — never let the LLM overwrite a native value.
  const zone = asProfileText(parsed.zone);
  if (zone && !update.zone) update.zone = zone;
  const city = asProfileText(parsed.city);
  if (city && !update.city) update.city = city;
  const year = typeof parsed.established_year === "number"
    ? parsed.established_year
    : typeof parsed.established_year === "string"
      ? parseInt(parsed.established_year, 10)
      : NaN;
  if (Number.isInteger(year)) update.established_year = year;
  const chef = asProfileText(parsed.executive_chef);
  if (chef) update.executive_chef = chef;
  const editorial = asProfileText(parsed.editorial_summary);
  if (editorial) update.editorial_summary = editorial;
  // Canonical Presentation — English only (MESITA-939). Spanish TMS later.
  const description = asProfileText(parsed.description);
  if (description) {
    update.description = formatDescriptionParagraphs(description).slice(0, ENRICH_DESCRIPTION_MAX);
  }
  // MESITA-1247: validate before it lands on the row. json_object mode only
  // *describes* the schema to the model — it can and does return off-type or
  // extra fields — so a malformed blob is dropped rather than trusted, per
  // this function's own rule above ("only sets a field when synthesis
  // actually produced a USABLE value" — a shape the validator rejects isn't
  // usable). Writes back the ORIGINAL parsed value on success, not the
  // schema's normalized output — object() always returns every shape key
  // (nullable ones as explicit null), which would silently reshape a
  // legitimate partial object into a wider one; this only needs a gate, not
  // a rewrite, and a byte-identical write is the smaller behaviour change.
  if (parsed.details && typeof parsed.details === "object" && !Array.isArray(parsed.details)) {
    const validated = PlaceDetailsSchema.parse(parsed.details);
    if (validated.ok) update.details = parsed.details;
  }
  // products.menu is no longer synthesised — the website (its only source) is no
  // longer scraped. Existing menus on the place are left untouched.
  if (Array.isArray(parsed.popular_times) && parsed.popular_times.length > 0) {
    const validated = PopularTimesSchema.parse(parsed.popular_times);
    if (validated.ok) update.popular_times = parsed.popular_times;
  }
}
