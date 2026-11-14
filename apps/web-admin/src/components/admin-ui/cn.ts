import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class lists; a later utility wins over an earlier one of its group. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
