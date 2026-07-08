import type { LucideIcon } from "lucide-react";
import { MessagesSquare, Settings2 } from "lucide-react";

// One sidebar entry — "Memo Config". Memo is Mesita's consumer AI concierge (the
// consumer-web-ask-memo Edge Function); this page tunes its persona, model, and
// place-retrieval knobs. Single subpage today, kept as a tab so the config pages
// (Atlas / Enricher / Memo) share chrome.
export const MEMO_PARENT = {
  href: "/memo-config",
  label: "Memo Config",
  Icon: MessagesSquare,
} as const;

export const MEMO_SUBROUTES = [
  { href: "/memo-config/config", label: "Config", Icon: Settings2 },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;

export function isMemoRoute(pathname: string): boolean {
  return (
    pathname === MEMO_PARENT.href ||
    pathname.startsWith(`${MEMO_PARENT.href}/`)
  );
}
