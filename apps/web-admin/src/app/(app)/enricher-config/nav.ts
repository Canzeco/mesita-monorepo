import type { LucideIcon } from "lucide-react";
import { FlaskConical, Settings2, Wand2 } from "lucide-react";

// One sidebar entry — "Enricher Config" — with two tabs. The Enricher is the
// cron pipeline that builds place profiles from the open web ("Atlas" is its
// legacy brand). This page tunes its pipeline behaviour and prices a run; the
// profile spec it writes into lives on the separate Atlas Config page.
export const ENRICHER_PARENT = {
  href: "/enricher-config",
  label: "Enricher Config",
  Icon: Wand2,
} as const;

export const ENRICHER_SUBROUTES = [
  { href: "/enricher-config/config", label: "Config", Icon: Settings2 },
  { href: "/enricher-config/playground", label: "Playground", Icon: FlaskConical },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
