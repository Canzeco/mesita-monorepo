"use client";

// A SELECTOR, in the rail's own ink (MESITA-1848).
//
// Pato, 2026-09-14: *"better three sections — ACCOUNT SELECTOR (no subitems) /
// ORGANIZATION SELECTOR … / PLACE SELECTOR …"*. The rail stops being a flat
// list of destinations and becomes three SUBJECTS, each headed by the thing it
// is about. The head is a selector, so the column answers "which account,
// which organization, which place" beside "which page" — the question an
// operator asks first, and the one the console has moved four times today
// (the Organization page's in MESITA-1822, Account's in MESITA-1832, split
// again in MESITA-1847, and here).
//
// A SELECTOR WITH NOTHING TO SWITCH IS A NAME (MESITA-1818, 3A): at one
// organization or one place no chevron renders and the row still opens its
// menu, which is where the ceremony lives (Create organization · Add place).
// THE TRANSITION IS THE CLOCK: a choice shows the chosen name only while the
// `router.push` it started is in flight.
//
// DARK, like everything else in this column (MESITA-1831): `sidebar-*` tokens
// only on the trigger. The MENU is a popover over the page, not part of the
// rail, so it keeps the page's own tokens — a dark menu floating over a light
// screen is a different surface pretending to be this one.
//
// AT `w-16` IT IS ITS CHIP. There is no room for a name, and the chip is the
// one thing that still identifies the subject; the accessible name rides the
// trigger's `aria-label`, which is on it at every width.

import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

// THE MENU'S OWN CLASSES LIVE HERE, not in the rail. The popover is a surface
// over the PAGE, so it wears page tokens — and `Sidebar.tsx` is forbidden from
// naming a page token at all (the dark-rail rule, MESITA-1831). Keeping them
// on this side of the import is what lets both rules be true at once.
export const MENU_ITEM = "gap-2.5 rounded-lg py-1.5 text-[13px]";
export const MENU_MUTED = `${MENU_ITEM} text-muted-foreground`;
export const MENU_CHIP =
  "bg-muted text-foreground ring-border flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ring-1";

export function RailSelector({
  label,
  name,
  meta,
  chip,
  switchable,
  pending,
  collapsed,
  children,
}: {
  /** The accessible name — "Switch organization". Never the subject's own
   *  name, which changes under the operator and would rename the control. */
  label: string;
  name: string;
  /** The one line under the name: what the menu would otherwise hide. */
  meta: string;
  chip: React.ReactNode;
  switchable: boolean;
  pending: boolean;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={label}
        aria-busy={pending || undefined}
        title={`${label}: ${name}`}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
          "hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent",
          FOCUS_RING,
          collapsed && "justify-center px-0",
        )}
      >
        {chip}
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-sidebar-foreground truncate text-[13px] font-semibold">
                {name}
              </span>
              <span className="text-sidebar-muted truncate text-[11px]">
                {meta}
              </span>
            </span>
            {switchable && (
              <ChevronsUpDown
                aria-hidden
                className="text-sidebar-muted h-3.5 w-3.5 shrink-0"
              />
            )}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-64 motion-reduce:animate-none"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
