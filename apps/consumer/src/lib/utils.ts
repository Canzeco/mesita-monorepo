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
