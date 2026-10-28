// Small JSON / string parsing helpers shared by the Enricher and business onboarding.

export function numOf(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[, ]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Turn a category slug (`fine_dining`) into a display label in sentence
 *  case (`Fine dining`; MESITA-2659, Pato: "take care of the camel case").
 *  Google's own stub labels already read this way ("Sports bar"). */
export function humanizeCategorySlug(
  category: string | null | undefined,
): string | null {
  if (!category) return null;
  const words = category.trim().replace(/_/g, " ").replace(/\s+/g, " ")
    .toLowerCase();
  if (!words) return null;
  return words[0].toUpperCase() + words.slice(1);
}

/**
 * Parse the first JSON object from an LLM response (strips markdown fences).
 * Hardened for Sonar/Agent `json_schema` responses under load (MESITA-192):
 * trailing commas, truncated closing braces, and leading/trailing prose.
 */
export function safeParseJson(content: string): unknown | null {
  if (!content) return null;
  let s = content.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = s.indexOf("{");
  if (start === -1) return null;
  let end = s.lastIndexOf("}");
  // Truncated responses sometimes omit the final `}` — close the object if we
  // still have a plausible `{…` payload (common under concurrent Sonar load).
  if (end === -1 || end <= start) {
    const open = s.slice(start);
    if (open.length < 2) return null;
    s = open + "}";
    end = s.length - 1;
  } else {
    s = s.slice(start, end + 1);
  }
  const attempts = [s, s.replace(/,\s*([}\]])/g, "$1")];
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try next */
    }
  }
  return null;
}
