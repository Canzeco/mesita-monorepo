import type { LucideIcon } from "lucide-react";
import { Calculator, ListChecks, Settings2, Sparkles } from "lucide-react";

// One sidebar entry — "Atlas Config" — with three tabs. Merges what used to be
// two separate items (the profile spec + the Enricher pipeline params). The
// Enricher builds place profiles; the profile spec defines their shape, so they
// now live on one page.
export const ATLAS_PARENT = {
  href: "/atlas-config",
  label: "Atlas Config",
  Icon: Sparkles,
} as const;

export const ATLAS_SUBROUTES = [
  { href: "/atlas-config/fields", label: "Atlas Params", Icon: ListChecks },
  { href: "/atlas-config/configuration", label: "Enricher Params", Icon: Settings2 },
  { href: "/atlas-config/calculator", label: "Enricher Calculator", Icon: Calculator },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;

export function isAtlasRoute(pathname: string): boolean {
  return (
    pathname === ATLAS_PARENT.href ||
    pathname.startsWith(`${ATLAS_PARENT.href}/`)
  );
}
