import type { LucideIcon } from "lucide-react";
import {
  FlaskConical,
  MessagesSquare,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

// Chat is the one consumer surface with an agent behind it, so it carries a
// second tab strip the other five surfaces don't need. Memo Config used to be
// its own sidebar parent (/memo-config); it lives here because Home › Chat IS
// Memo — configuring the surface and configuring the agent were always the
// same job in two places.
//
// One concern per tab, and therefore at most one Save per tab: Memo writes the
// app_config memo_* columns, Filters writes the filters_config blob. Stacking
// them on one page would put two independent save buttons on one screen.
export const CHAT_SUBROUTES = [
  {
    href: "/filters-config/chat/memo",
    label: "Memo",
    Icon: MessagesSquare,
  },
  {
    href: "/filters-config/chat/filters",
    label: "Filters",
    Icon: SlidersHorizontal,
  },
  {
    href: "/filters-config/chat/playground",
    label: "Playground",
    Icon: FlaskConical,
  },
  {
    href: "/filters-config/chat/data-access",
    label: "Data Access",
    Icon: ShieldCheck,
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
