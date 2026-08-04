import type { LucideIcon } from "lucide-react";
import {
  FlaskConical,
  MessagesSquare,
  Settings2,
  ShieldCheck,
} from "lucide-react";

// Memo Config — three sub-tabs. "Config" tunes the persona + models;
// "Playground" chats with the agent live; "Data Access" documents the closed set
// of Edge Functions Memo may read through (it holds no database client).
// MEMO_PARENT is the single Sidebar entry (Configs group); MEMO_SUBROUTES are
// the in-page tabs and are never added to the Sidebar (mirrors
// enricher-config / lineup-config).
export const MEMO_PARENT = {
  href: "/memo-config",
  label: "Memo Config",
  Icon: MessagesSquare,
} as const;

export const MEMO_SUBROUTES = [
  { href: "/memo-config/config", label: "Config", Icon: Settings2 },
  { href: "/memo-config/playground", label: "Playground", Icon: FlaskConical },
  { href: "/memo-config/data-access", label: "Data Access", Icon: ShieldCheck },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
