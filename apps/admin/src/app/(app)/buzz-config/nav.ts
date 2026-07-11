import { Megaphone } from "lucide-react";

// One sidebar entry — "Buzz Config". A single flat page, no sub-tabs; the
// surface ships as a placeholder ready to receive its knobs.
export const BUZZ_PARENT = {
  href: "/buzz-config",
  label: "Buzz Config",
  Icon: Megaphone,
} as const;
