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
