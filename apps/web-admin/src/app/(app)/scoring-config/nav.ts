import { Gauge } from "lucide-react";

// One sidebar entry — "Scoring Config". A single flat page, no sub-tabs; the
// surface ships as a placeholder ready to receive its knobs.
export const SCORING_PARENT = {
  href: "/scoring-config",
  label: "Scoring Config",
  Icon: Gauge,
} as const;
