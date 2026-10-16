import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Same merge rules as the consumer `cn`: `rounded-panel` is a named radius,
// not a t-shirt step. Unextended twMerge would drop it next to `rounded-lg`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["panel"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function firstInitial(name: string, fallback = "·"): string {
  return name.trim().slice(0, 1).toUpperCase() || fallback;
}

export function formatRating(rating: number | null | undefined): string | null {
  return rating != null ? rating.toFixed(1) : null;
}

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

/** Place-detail distance chip: null/≤0 means "couldn't calculate" → "- km". */
export function formatDistanceKm(km: number | null | undefined): string {
  if (km == null || km <= 0) return "- km";
  return `${km} km`;
}

/** Compact count for chips: 1.2K / 12K / 1.5M. When `exact`, keep mid-range
 *  counts as locale integers (e.g. review totals as "1,891"). */
export function formatCompactCount(n: number, exact = false): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (exact && n >= 1000) return n.toLocaleString("en-US");
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toString();
}
