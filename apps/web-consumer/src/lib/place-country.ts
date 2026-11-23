// A place's country, read from its address on the client (MESITA-4711,
// Pato: "a flag to represent the country of the place … for the social
// events"). Google's Mexican addresses end in the STATE ("…, Monterrey,
// N.L."); others end in the country name ("…, Indonesia"). Unknown → null,
// and the caller draws no flag.

const COUNTRY_NAMES: Record<string, string> = {
  mexico: "MX",
  méxico: "MX",
  indonesia: "ID",
  "hong kong": "HK",
  "united states": "US",
  usa: "US",
  canada: "CA",
  spain: "ES",
  españa: "ES",
  colombia: "CO",
  argentina: "AR",
  chile: "CL",
  peru: "PE",
  perú: "PE",
  brazil: "BR",
  brasil: "BR",
  france: "FR",
  italy: "IT",
  germany: "DE",
  "united kingdom": "GB",
  uk: "GB",
  japan: "JP",
  singapore: "SG",
  thailand: "TH",
  australia: "AU",
};

// Google's abbreviations for Mexico's 32 states, lower-cased.
const MX_STATES = new Set([
  "ags.",
  "b.c.",
  "b.c.s.",
  "camp.",
  "chis.",
  "chih.",
  "cdmx",
  "coah.",
  "col.",
  "dgo.",
  "gto.",
  "gro.",
  "hgo.",
  "jal.",
  "méx.",
  "mex.",
  "mich.",
  "mor.",
  "nay.",
  "n.l.",
  "oax.",
  "pue.",
  "qro.",
  "q.r.",
  "q.roo",
  "s.l.p.",
  "sin.",
  "son.",
  "tab.",
  "tamps.",
  "tlax.",
  "ver.",
  "yuc.",
  "zac.",
]);

/** ISO 3166-1 alpha-2 of the place's country, or null. */
export function placeCountry(
  address: string | null | undefined,
): string | null {
  if (!address) return null;
  const parts = address
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const last = parts.at(-1);
  if (!last) return null;
  if (COUNTRY_NAMES[last]) return COUNTRY_NAMES[last];
  // "N.L." or "64849 N.L." — a postcode may lead the state.
  const state = last.replace(/^\d{4,5}\s+/, "");
  if (MX_STATES.has(state)) return "MX";
  return null;
}

/** The emoji flag for an ISO alpha-2 code: two regional-indicator letters. */
export function flagEmoji(code: string): string {
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}
