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

// First letter of a name/label, upper-cased, for avatar chips. Trims so
// leading whitespace never becomes the "initial", and falls back to a
// neutral glyph when the source is empty/blank. Single source so every
// avatar in the console renders the same way.
export function initialLetter(
  source: string | null | undefined,
  fallback = "·",
): string {
  return (source ?? "").trim().slice(0, 1).toUpperCase() || fallback;
}

// Abbreviate a count for compact display: 1.2M / 3.4K / locale string.
// Used for review counts, follower counts, and other large tallies.
export function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}


/** $-symbol price level for catalog/preview chips (e.g. $$$). */
export function formatPriceLevelSymbols(
  priceLevel: number | null | undefined,
): string | null {
  if (priceLevel == null || priceLevel < 1) return null;
  const level = Math.min(4, Math.max(1, Math.round(priceLevel)));
  return "$".repeat(level);
}
