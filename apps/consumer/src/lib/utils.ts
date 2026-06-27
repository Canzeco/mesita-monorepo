import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Unwrap an arbitrary thrown value to a user-facing message, falling
// back to the call-site default when the throwable isn't an Error
// (e.g. fetch rejected with a plain object).
export function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// First letter of a name, uppercased, with a placeholder when the
// trimmed name is empty. Used by avatar/photo placeholders.
export function firstInitial(name: string, fallback = "·"): string {
  return name.trim().slice(0, 1).toUpperCase() || fallback;
}

// "2 days ago" style relative label from an ISO timestamp. Returns
// undefined for missing / unparseable input so callers can fall back to
// their own copy ("recently"). Shared by the place detail adapter and the
// card overview deriver so the freshness signal reads identically on both.
export function relativeLabel(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return undefined;
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

// Great-circle distance in kilometres between two lat/lng points
// (haversine, mean Earth radius 6371 km). Used to turn a place's
// coordinates + the consumer's geolocation into the "X km" card chip.
// Accuracy is plenty for a "how far is this" signal — we round to one
// decimal under 10 km and to the nearest km beyond.
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
