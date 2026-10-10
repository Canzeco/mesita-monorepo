import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// The two helpers the shared place surface reaches by alias (MESITA-2086);
// same bodies as web-business's, so a generated component merges classes
// identically in both consoles.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
