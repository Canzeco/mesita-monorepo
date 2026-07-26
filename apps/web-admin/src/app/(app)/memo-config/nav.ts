import type { LucideIcon } from "lucide-react";
import { FlaskConical, MessagesSquare, Settings2 } from "lucide-react";

// Memo Config — two sub-tabs. "Config" tunes the persona + models; "Playground"
// runs one live Memo query at the current saved settings. MEMO_PARENT is the
// single Sidebar entry (Configs group); MEMO_SUBROUTES are the in-page tabs and
// are never added to the Sidebar (mirrors enricher-config / lineup-config).
export const MEMO_PARENT = {
  href: "/memo-config",
  label: "Memo Config",
  Icon: MessagesSquare,
} as const;

export const MEMO_SUBROUTES = [
  { href: "/memo-config/config", label: "Config", Icon: Settings2 },
  { href: "/memo-config/playground", label: "Playground", Icon: FlaskConical },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
