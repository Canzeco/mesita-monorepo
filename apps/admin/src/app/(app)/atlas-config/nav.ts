import { Sparkles } from "lucide-react";

// One sidebar entry — "Atlas Config" — the profile spec: the controlled
// vocabulary and field limits the Enricher and operators write place profiles
// with. A single flat page (no sub-tabs). The Enricher's pipeline behaviour
// lives on the separate Enricher Config page.
export const ATLAS_PARENT = {
  href: "/atlas-config",
  label: "Atlas Config",
  Icon: Sparkles,
} as const;

export function isAtlasRoute(pathname: string): boolean {
  return (
    pathname === ATLAS_PARENT.href ||
    pathname.startsWith(`${ATLAS_PARENT.href}/`)
  );
}
