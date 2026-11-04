// Where the Business app lives (MESITA-3103): the place screen's "Is this your
// business?" and the Upgrade sheet's ownership box open its claim page. The
// address is NEXT_PUBLIC_BUSINESS_URL when the Vercel project sets it, else the
// production app (MESITA-3203: unset, these doors silently never drew).

const BUSINESS_URL = "https://business.mesita.ai";

export function businessClaimHref(placeId: string): string {
  const raw = process.env.NEXT_PUBLIC_BUSINESS_URL?.trim() || BUSINESS_URL;
  const base = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  return `${base}/claim/${encodeURIComponent(placeId)}`;
}
