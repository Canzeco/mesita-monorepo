import { capPresentation } from "./presentation-cap.ts";

export type ProfileResult = {
  zone?: string | null;
  city?: string | null;
  /**
   * The LLM's English blurb. A classifier INPUT the contents stage reads off
   * `parsed` — NOT applied by applyProfileToUpdate, because it is no longer a
   * place_profiles column (MESITA-2144).
   */
  editorial_summary?: string | null;
  /** Canonical Presentation — always English (Mesita core language). */
  description?: string | null;
  /**
   * Clean Mesita display name (§8.4 v3): the Google label stripped of chain
   * suffixes, slogans, and city tags; proper case. NOT applied by
   * applyProfileToUpdate — only the place-name-door may land it (gate D2).
   */
  mesita_name?: string | null;
  /** Mesita tags (MESITA-2790): vocabulary slugs; filtered by the caller. */
  tags?: unknown;
  /** Mesita Families (MESITA-2891): 1–5 family slugs; filtered by the caller. */
  families?: unknown;
  /** Retired (MESITA-2420). A stale reply may still carry it; it is never applied. */
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
  // Location is Google's structured response. Synthesis may read those facts
  // as input for Presentation. It does not write zone, city, or address.
  // Canonical Presentation — English only (MESITA-939). Spanish TMS later.
  const description = asProfileText(parsed.description);
  if (description) {
    // Cut at a sentence, never mid-word (MESITA-2641).
    update.description = capPresentation(formatDescriptionParagraphs(description));
  }
  // products.menu is no longer synthesised — the website (its only source) is no
  // longer scraped. Existing menus on the place are left untouched.
  // popular_times is not synthesised either (MESITA-2420): the model could only
  // guess busy hours from review text, under a card that says "From Google".
}
