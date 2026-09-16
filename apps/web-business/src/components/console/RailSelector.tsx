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
// A SELECTOR WITH NOTHING TO SWITCH IS A NAME (MESITA-1818, 3A): at one place
// the rail does not render this at all. THE TRANSITION IS THE CLOCK: a choice
// shows the chosen name only while the `router.push` it started is in flight.
//
// THERE IS ONE SELECTOR LEFT (MESITA-1892). There were two — the organization
// and its place — and this component was written for both, which is why it
// takes a `chip` rather than drawing one. It keeps that shape: the place wears
// its own photo, and the slot is what made two subjects share one control in
// the first place.
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
import { ChevronsUpDown, Search } from "lucide-react";
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
/** THE ONE GLYPH BOX. Identical to the rail's `ICON` box, so a selector's
 *  chip and a row's icon share one left edge and one centre line. Anything
 *  bigger here re-opens the ragged column MESITA-1849 closed. */
export const SELECTOR_CHIP =
  "h-4 w-4 lg:h-3.5 lg:w-3.5 shrink-0 overflow-hidden rounded-[4px] flex items-center justify-center text-[8px] font-semibold leading-none";

/** The line a filter leaves behind when it matches nothing. Muted, one row
 *  tall, in the menu's own page tokens — and here, not in the rail, for the
 *  same reason every other class on this page is here (MESITA-1831). */
export const MENU_EMPTY = "text-muted-foreground px-2 py-1.5 text-[13px]";

/** Every row a menu will let you land on, whatever its role: a plain
 *  `menuitem`, a `menuitemradio` (the places), a `menuitemcheckbox`. Radix
 *  marks an unavailable one `data-disabled`, and focusing that row is a dead
 *  end, so it is excluded here exactly as Radix excludes it. */
export const MENU_ITEM_SELECTOR = '[role^="menuitem"]:not([data-disabled])';

/** Which end of the list a key asks for, or `null` when the key is not one of
 *  the four. ArrowDown and Home enter at the top; ArrowUp and End at the
 *  bottom — the same four keys Radix itself calls FIRST_LAST_KEYS. */
export function menuJumpEdge(key: string): "first" | "last" | null {
  if (key === "ArrowDown" || key === "Home") return "first";
  if (key === "ArrowUp" || key === "End") return "last";
  return null;
}

/** Hand focus from a field inside a menu to that menu's first or last row.
 *  `from` is the field; the menu is whatever `[data-radix-menu-content]`
 *  contains it, which is the same anchor Radix uses to decide a key happened
 *  "inside" the menu. Returns whether there was a row to take it. */
export function focusMenuEdge(
  from: Element | null | undefined,
  edge: "first" | "last",
): boolean {
  const content = from?.closest("[data-radix-menu-content]");
  const items = content?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR);
  if (!items || items.length === 0) return false;
  const target = edge === "first" ? items[0] : items[items.length - 1];
  target.focus();
  return true;
}

/** THE FIELD'S WHOLE KEYBOARD, in one exported function so a test can press
 *  a key at it (components/console/rail-selector.test.ts) instead of reading
 *  this file and hoping. Four keys leave for the rows, three belong to the
 *  menu (Enter picks, Tab is Radix's, Escape is answered by the content's
 *  `onEscapeKeyDown`), and everything else is typing and must not reach the
 *  menu's typeahead. */
export function handleMenuSearchKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
): void {
  const edge = menuJumpEdge(e.key);
  if (edge) {
    // preventDefault FIRST: otherwise the caret walks the query instead of
    // the operator walking the rows.
    e.preventDefault();
    focusMenuEdge(e.currentTarget, edge);
    return;
  }
  if (e.key === "Enter" || e.key === "Tab" || e.key === "Escape") return;
  e.stopPropagation();
}

/** A FIELD INSIDE A MENU, which Radix does not expect.
 *
 *  Three things make it work, and all three are invisible until they are
 *  missing:
 *
 *  TYPEAHEAD. `DropdownMenu` listens for printable keys on the content and
 *  jumps to the row that starts with them. Left alone it eats every character
 *  aimed at this input — you type "cafe" and the menu hops to four different
 *  rows while the field stays empty. `stopPropagation` on the keystrokes that
 *  belong to the input is what stops that. Enter and Tab are deliberately NOT
 *  stopped, and neither is Escape: those belong to the menu.
 *
 *  ARROWS, MOVED BY HAND. The first build let ArrowDown/ArrowUp/Home/End fall
 *  through on the assumption Radix would carry focus from the field to a row.
 *  IT DOES NOT: `@radix-ui/react-menu` guards that handler with
 *  `event.target !== contentRef.current` — the target here is the INPUT, so
 *  the handler returns — and RovingFocusGroup only answers arrows on an item
 *  that already has focus. Tab is preventDefaulted by the content itself. The
 *  field was a keyboard trap: with eight places on screen there was no key
 *  that reached one. So the jump is made explicitly, and from the first row
 *  onward Radix's own roving focus takes over.
 *
 *  FOCUS ON OPEN. Radix focuses the first ITEM when the menu opens, which
 *  would put the caret nowhere. The selector's `autoFocusRef` sends it here.
 *
 *  ESCAPE IS NOT HERE. It cannot be: `useEscapeKeydown` listens on the
 *  DOCUMENT in the CAPTURE phase, so the menu is already dismissed by the time
 *  a bubble-phase handler on this input runs. A two-stage Escape — clear the
 *  query, then close — has to be asked for where Radix asks: the content's
 *  `onEscapeKeyDown`, which `RailSelector` forwards. */
export function MenuSearch({
  value,
  onChange,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="bg-popover sticky top-0 z-10 flex items-center gap-2 px-2 py-1.5">
      <Search aria-hidden className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        aria-label={placeholder}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleMenuSearchKeyDown}
        className="placeholder:text-muted-foreground flex-1 bg-transparent text-[13px] outline-none"
      />
    </div>
  );
}

export function RailSelector({
  label,
  name,
  chip,
  switchable,
  pending,
  collapsed,
  autoFocusRef,
  onEscapeKeyDown,
  onOpenChange,
  children,
}: {
  /** The accessible name — "Switch place". Never the subject's own name,
   *  which changes under the operator and would rename the control. */
  label: string;
  name: string;
  chip: React.ReactNode;
  switchable: boolean;
  pending: boolean;
  collapsed: boolean;
  /** Where the caret goes when the menu opens, when the menu has a field in
   *  it at all. Unset — every selector that has nothing to search — and Radix
   *  keeps its own behaviour: focus the first row. */
  autoFocusRef?: React.RefObject<HTMLInputElement | null>;
  /** THE ONLY PLACE ESCAPE CAN BE ANSWERED. Radix dismisses on a
   *  document-level CAPTURE listener, so nothing inside the menu — an input's
   *  own `onKeyDown` least of all — gets the key first. `DismissableLayer`
   *  calls this BEFORE it checks `defaultPrevented`, so a caller that wants
   *  Escape to mean something else this once (clear the query, keep the menu)
   *  calls `preventDefault()` here and the menu stays open. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** Every close, by every route: Escape, a click outside, a pick, the
   *  trigger again. A menu with state of its own (a typed query) resets it
   *  here, because resetting on the ONE path that was thought of leaves the
   *  next open wearing a filter nobody typed. */
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
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
        onEscapeKeyDown={onEscapeKeyDown}
        onOpenAutoFocus={
          autoFocusRef &&
          ((e: Event) => {
            e.preventDefault();
            autoFocusRef.current?.focus();
          })
        }
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
