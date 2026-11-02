// Where the Business app lives (MESITA-3103). The profile editor is there
// now; admin's Single Place links to it. The address comes from
// NEXT_PUBLIC_BUSINESS_URL (set on the Vercel project), never from code:
// unset, the door draws disabled and says so.

export function businessBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_BUSINESS_URL?.trim();
  if (!raw) return null;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

/** A Business app place view, or null when the app's address is not set. */
export function businessPlaceHref(placeId: string, view: "profile" | "premier" | "internal"): string | null {
  const base = businessBaseUrl();
  return base ? `${base}/places/${encodeURIComponent(placeId)}/${view}` : null;
}
