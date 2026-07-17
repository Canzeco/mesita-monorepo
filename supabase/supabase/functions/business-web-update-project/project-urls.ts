export const URL_FIELDS = [
  "website_url",
  "instagram_url",
  "facebook_url",
  "whatsapp_url",
  "opentable_url",
  "resy_url",
  "uber_eats_url",
  "x_url",
  "threads_url",
  "reddit_url",
  "didi_food_url",
] as const;

export type UrlField = (typeof URL_FIELDS)[number];

export function isUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    // Require https — http:// breaks mixed-content guards in the browser.
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** POS / booking endpoint: https URL or a phone/email deep link. */
export function isReservationEndpoint(v: string): boolean {
  try {
    const u = new URL(v);
    return (
      u.protocol === "https:" ||
      u.protocol === "tel:" ||
      u.protocol === "mailto:" ||
      u.protocol === "sms:"
    );
  } catch {
    return false;
  }
}
