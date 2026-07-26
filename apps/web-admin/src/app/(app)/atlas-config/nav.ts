import type { LucideIcon } from "lucide-react";
import { FlaskConical, Settings2, Sparkles } from "lucide-react";

// Atlas Config — two sub-tabs. "Config" is the profile spec (edit matrix,
// controlled vocabulary, field limits); "Playground" previews which fields each
// writer may set. ATLAS_PARENT is the single Sidebar entry; ATLAS_SUBROUTES are
// the in-page tabs (never added to the Sidebar).
export const ATLAS_PARENT = {
  href: "/atlas-config",
  label: "Atlas Config",
  Icon: Sparkles,
} as const;

export const ATLAS_SUBROUTES = [
  { href: "/atlas-config/config", label: "Config", Icon: Settings2 },
  { href: "/atlas-config/playground", label: "Playground", Icon: FlaskConical },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
