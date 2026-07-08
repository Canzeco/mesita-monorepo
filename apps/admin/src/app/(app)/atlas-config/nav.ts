import type { LucideIcon } from "lucide-react";
import { Settings2, Sparkles } from "lucide-react";

// One sidebar entry — "Atlas Config" — the profile spec: the controlled
// vocabulary and field limits the Enricher and operators write place profiles
// with. The Enricher's pipeline behaviour lives on the separate Enricher Config
// page. Single subpage today, kept as a tab so the config pages share chrome.
export const ATLAS_PARENT = {
  href: "/atlas-config",
  label: "Atlas Config",
  Icon: Sparkles,
} as const;

export const ATLAS_SUBROUTES = [
  { href: "/atlas-config/config", label: "Config", Icon: Settings2 },
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
