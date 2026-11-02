// Where the Business app lives (MESITA-3103): the place screen's "Is this your
// business?" opens its claim page. The address comes from
// NEXT_PUBLIC_BUSINESS_URL (set on the Vercel project), never from code;
// unset, the row is not drawn and the place screen is unchanged.

export function businessClaimHref(placeId: string): string | null {
  const raw = process.env.NEXT_PUBLIC_BUSINESS_URL?.trim();
  if (!raw) return null;
  const base = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  return `${base}/claim/${encodeURIComponent(placeId)}`;
}
