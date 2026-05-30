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
// their own copy ("recently"). Shared by the venue detail adapter and the
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
