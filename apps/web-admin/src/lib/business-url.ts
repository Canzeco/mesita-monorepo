// Where the Business app lives (MESITA-3103). Every place page is there
// (MESITA-3104); admin's lists link to it. NEXT_PUBLIC_BUSINESS_URL wins when
// set (previews); unset, it is the production Business app (Pato,
// MESITA-3150: "move me to the business page when I click a place").

const BUSINESS_PRODUCTION_URL = "https://business.mesita.ai";

export function businessBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_BUSINESS_URL?.trim() || BUSINESS_PRODUCTION_URL;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

/** The place page lives in the Business app (MESITA-3104): staff open
 *  Reviews, Preview, Premier and Internal there. */
export type BusinessPlaceView = "profile" | "reviews" | "preview" | "premier" | "settings" | "admin";

/** A Business app place view, or null when the app's address is not set. */
export function businessPlaceHref(placeId: string, view: BusinessPlaceView): string | null {
  const base = businessBaseUrl();
  return base ? `${base}/places/${encodeURIComponent(placeId)}/${view}` : null;
}
