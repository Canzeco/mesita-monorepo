import { Map } from "lucide-react";

export const ATLAS_PARENT = {
  href: "/atlas-config",
  label: "Atlas Config",
  Icon: Map,
} as const;

export function isAtlasRoute(pathname: string): boolean {
  return (
    pathname === ATLAS_PARENT.href ||
    pathname.startsWith(`${ATLAS_PARENT.href}/`)
  );
}
