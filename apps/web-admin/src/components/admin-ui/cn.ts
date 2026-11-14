import { clsx, type ClassValue } from "clsx";

/**
 * Join class lists. No tailwind-merge on purpose (MESITA-3948): it would ship
 * ~7 KB gz to every route, and the kit never needs it. Kit components pick
 * one class per property through props (tone, size, leading), and a caller's
 * `className` is layout only (margin, width, grid placement), so two classes
 * never fight over one property.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
