import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// The two helpers the place surface reaches by alias (MESITA-2086); the
// business console's bodies, kept verbatim when MESITA-2089 deleted it, so
// its components merge classes exactly as they did there.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
