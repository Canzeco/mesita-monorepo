// Where the Business app lives (MESITA-3103). Every place page is there
// (MESITA-3104); admin's lists link to it. The address comes from
// NEXT_PUBLIC_BUSINESS_URL (set on the Vercel project), never from code:
// unset, the door draws disabled and says so.

export function businessBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_BUSINESS_URL?.trim();
  if (!raw) return null;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

/** The place page lives in the Business app (MESITA-3104): staff open
 *  Reviews, Preview, Premier and Internal there. */
export type BusinessPlaceView = "profile" | "reviews" | "preview" | "premier" | "settings" | "internal";

/** A Business app place view, or null when the app's address is not set. */
export function businessPlaceHref(placeId: string, view: BusinessPlaceView): string | null {
  const base = businessBaseUrl();
  return base ? `${base}/places/${encodeURIComponent(placeId)}/${view}` : null;
}
