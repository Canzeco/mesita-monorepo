// Display helpers — ported from apps/web-consumer/src/lib/utils.ts
// (subset needed by swipe + future ports). Keep in sync when web changes.

export function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function firstInitial(name: string, fallback = '·'): string {
  return name.trim().slice(0, 1).toUpperCase() || fallback;
}

export function formatRating(
  rating: number | null | undefined,
): string | null {
  return rating != null ? rating.toFixed(1) : null;
}

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function formatKm(km: number): string {
  return `${km < 10 ? km.toFixed(1) : Math.round(km).toString()} km`;
}

export function formatCompactCount(n: number, exact = false): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (exact && n >= 1000) return n.toLocaleString('en-US');
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toString();
}
