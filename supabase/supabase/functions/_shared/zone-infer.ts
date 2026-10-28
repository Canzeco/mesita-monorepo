// Mesita Zone, inferred (MESITA-2937). Pato, 2026-10-28: "CREATE NEW FIELD
// CALLED MESITA ZONE. THAT FIELD MUST BE INFERRED WITH LLM … is the one we
// show in profile header after category".
//
// Mesita Zone is `place_profiles.zone`, the fact the place header draws after
// the category. The Description step's one model call (Create's door and
// every Enrich) returns `zone` beside the families and the tags; this module
// is the rule it is shown and the validator its reply passes through.
// Google's neighborhood component is only a hint in the prompt: Google's
// canonical location is the Google Place ID and the Google Address.

/** One number with the header's 180px truncate: a zone is a short name. */
export const ZONE_MAX = 40;

/** The instruction both Description prompts carry for `zone`. */
export const ZONE_RULE =
  `"zone" is the Mesita Zone: the short name locals use for the part of the ` +
  `city where the place is — the neighborhood, colonia, district or ` +
  `landmark area (e.g. "Polanco", "Roma Norte", "Del Valle", "Zona ` +
  `Hotelera"). Read it from the address, the Google neighborhood hint and ` +
  `the sources, and say it the way locals do: "Residencial San Agustín 1er ` +
  `Sector" → "San Agustín", "Providencia 2a. Sección" → "Providencia". ` +
  `Google's hint can be a placeholder ("Sin Nombre 35"): skip it and take ` +
  `the next area the address names. Proper case, no street, number, postal ` +
  `code, city or state, at most ${ZONE_MAX} characters. Null only when ` +
  `nothing shows where in the city it is.`;

/**
 * The model's `zone` → a short display name, or null when it gave nothing
 * usable (the caller then keeps the stored zone). A value that is just the
 * city, or carries a digit (a street number or postal code), is refused.
 */
export function pickZone(raw: unknown, city?: string | null): string | null {
  if (typeof raw !== "string") return null;
  const zone = raw.replace(/\s+/g, " ").trim().replace(/[.,;]+$/, "");
  if (!zone || zone.length > ZONE_MAX || /\d/.test(zone)) return null;
  if (/^(null|none|n\/a|unknown)$/i.test(zone)) return null;
  const fold = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
  if (city && fold(zone) === fold(city.trim())) return null;
  return zone;
}
