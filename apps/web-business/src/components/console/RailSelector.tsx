"use client";

// A SELECTOR — the head of a group, at the SAME SIZE as the pages beneath it
// (MESITA-1848; sized down in MESITA-1849).
//
// Pato, 2026-09-14, on a screenshot of the first build: *"this looks like
// shit. make it cleaner."* Three faults, all measurable:
//
//   TWO GLYPH COLUMNS. The chip was 28px starting at 10px while a row's icon
//   is 14px starting at 28px, so no two marks in the column shared a left
//   edge and the whole rail read ragged.
//
//   NOTHING NESTED. Chip 28 + gap 10 put the selector's label at ~48px and
//   its children's at ~52px — four pixels apart, which is no hierarchy at
//   all. Thirteen rows, one flat list.
//
//   THREE ROW HEIGHTS. A two-line trigger among one-line rows, against the
//   law Pato set two issues earlier: "don't use lots of fucking different
//   styles in the same menu."
//
// RANK BY COLOUR AND POSITION, NEVER BY SIZE. The selector is the BRIGHT
// thing — full `sidebar-foreground`, semibold — and its pages are muted and
// indented past its label. That is the entire hierarchy, and it costs no
// pixels. The meta it used to print on a second line ("Owner · 0 places",
// "In Pato") moved into the MENU, where the alternatives it compares against
// already live; on the trigger it was answering a question nobody had asked
// yet at twice the height of a real destination.
//
// A SELECTOR WITH NOTHING TO SWITCH IS A NAME (MESITA-1818, 3A): at one
// organization or one place no chevron renders and the row still opens its
// menu, which is where the ceremony lives. THE TRANSITION IS THE CLOCK: a
// choice shows the chosen name only while the `router.push` it started is in
// flight.
//
// DARK, like everything else in this column (MESITA-1831): `sidebar-*` tokens
// only on the trigger. The MENU is a popover over the page, not part of the
// rail, so it keeps the page's own tokens — a dark menu floating over a light
// screen is a different surface pretending to be this one.
//
// AT `w-16` IT IS ITS CHIP, and the chip is already the icon's size, so the
// collapsed rail is one unbroken column of marks. The accessible name rides
// the trigger's `aria-label`, which is on it at every width.

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
/** The line the trigger stopped printing: the role and the holding, on the
 *  menu row it actually compares. */
export const MENU_META =
  "text-muted-foreground block truncate text-[11px] font-normal";
export const MENU_STACK = "flex min-w-0 flex-1 flex-col leading-tight";

/** THE ONE GLYPH BOX. Identical to the rail's `ICON` box, so a selector's
 *  chip and a row's icon share one left edge and one centre line. Anything
 *  bigger here re-opens the ragged column MESITA-1849 closed. */
export const SELECTOR_CHIP =
  "h-4 w-4 lg:h-3.5 lg:w-3.5 shrink-0 overflow-hidden rounded-[4px] flex items-center justify-center text-[8px] font-semibold leading-none";

export function RailSelector({
  label,
  name,
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
          // The row shape, to the pixel: same gap, same padding, same height.
          "flex w-full items-center gap-2.5 rounded-xl px-2.5 text-left transition",
          "min-h-11 lg:min-h-0 lg:py-2",
          "text-sidebar-foreground text-sm font-semibold lg:text-[13px]",
          "hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent",
          FOCUS_RING,
          collapsed && "justify-center px-0 py-2",
        )}
      >
        {chip}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate">{name}</span>
            {switchable && (
              <ChevronsUpDown
                aria-hidden
                className="text-sidebar-muted h-3 w-3 shrink-0"
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
