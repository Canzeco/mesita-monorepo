// THE FIELD'S KEYBOARD, PRESSED (MESITA-1803).
//
// The first build of the place picker's search field was a keyboard TRAP: it
// let ArrowDown/ArrowUp/Home/End fall through, on the assumption that Radix
// would carry focus from the input to a row. It does not.
// `@radix-ui/react-menu` 2.1.16 guards that handler with
// `event.target !== contentRef.current` — the target is the input, so it
// returns — and RovingFocusGroup only answers arrows on an item that already
// holds focus. Tab is preventDefaulted by the content. With eight places on
// screen there was no key that reached one, and every source-reading test in
// the repo passed against it.
//
// So this file PRESSES THE KEYS. The handler and the focus move are exported
// as plain functions, and the menu they reach into is a fake one: an input
// whose `closest` answers with a content node whose `querySelectorAll` hands
// back rows that record being focused. No jsdom, no browser (this app is OTP
// walled), and nothing here can pass against the broken version — the broken
// version never called `focus()` at all.
import { describe, expect, it, vi } from "vitest";
import {
  MENU_ITEM_SELECTOR,
  focusMenuEdge,
  handleMenuSearchKeyDown,
  menuJumpEdge,
} from "./RailSelector";

type Row = { focus: () => void; focused: boolean };

/** A row that remembers being focused, the way a real menu item would take
 *  focus and light up. */
function row(): Row {
  const r: Row = { focus: () => {}, focused: false };
  r.focus = () => {
    r.focused = true;
  };
  return r;
}

/** The fake menu: `input` is what a keydown's `currentTarget` is, and it
 *  finds `content` through `closest`, exactly as the real input finds the
 *  real `[data-radix-menu-content]`. Records the selectors it was asked for. */
function menu(rows: Row[]) {
  const asked: string[] = [];
  const closests: string[] = [];
  const content = {
    querySelectorAll: (sel: string) => {
      asked.push(sel);
      return rows;
    },
  };
  const input = {
    closest: (sel: string) => {
      closests.push(sel);
      return sel === "[data-radix-menu-content]" ? content : null;
    },
  };
  return { asked, closests, input: input as unknown as HTMLInputElement };
}

/** A keydown with the two methods the handler may call, each recording. */
function press(key: string, input: HTMLInputElement) {
  const e = {
    key,
    currentTarget: input,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
  handleMenuSearchKeyDown(
    e as unknown as Parameters<typeof handleMenuSearchKeyDown>[0],
  );
  return e;
}

describe("the picker's search field is not a keyboard trap", () => {
  // FAILURE PREVENTED: ArrowDown in the field moved nothing, because Radix's
  // FIRST_LAST_KEYS handler ignores a key whose target is not the content.
  it("ArrowDown and Home land on the first row, ArrowUp and End on the last", () => {
    for (const key of ["ArrowDown", "Home"]) {
      const rows = [row(), row(), row()];
      const m = menu(rows);
      const e = press(key, m.input);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(rows.map((r) => r.focused)).toEqual([true, false, false]);
    }
    for (const key of ["ArrowUp", "End"]) {
      const rows = [row(), row(), row()];
      const m = menu(rows);
      const e = press(key, m.input);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(rows.map((r) => r.focused)).toEqual([false, false, true]);
    }
  });

  // FAILURE PREVENTED: the jump asks the wrong node or the wrong rows — the
  // places are `menuitemradio`, not `menuitem`, and a `data-disabled` row is
  // a dead end Radix itself skips.
  it("it asks the menu it is inside for every enabled row, whatever the role", () => {
    const m = menu([row()]);
    focusMenuEdge(m.input, "first");
    expect(m.closests).toEqual(["[data-radix-menu-content]"]);
    expect(m.asked).toEqual([MENU_ITEM_SELECTOR]);
    // A prefix match, so the radio rows this menu is made of qualify.
    expect(MENU_ITEM_SELECTOR).toContain('[role^="menuitem"]');
    expect(MENU_ITEM_SELECTOR).toContain(":not([data-disabled])");
  });

  // FAILURE PREVENTED: a query that matches nothing renders zero rows, and a
  // blind `items[0].focus()` would throw on the operator's next arrow key.
  it("an empty menu takes no focus and does not throw", () => {
    const m = menu([]);
    expect(focusMenuEdge(m.input, "first")).toBe(false);
    expect(focusMenuEdge(m.input, "last")).toBe(false);
    // And a field that is not inside a menu at all.
    expect(focusMenuEdge(null, "first")).toBe(false);
  });

  // FAILURE PREVENTED: the menu's typeahead eats what is typed at the field —
  // you type "cafe" and the menu hops to four rows while the field stays
  // empty — or, the other way, the field swallows the keys the MENU owns.
  it("typing is stopped, and Enter, Tab and Escape are left to the menu", () => {
    const m = menu([row()]);
    const typed = press("a", m.input);
    expect(typed.stopPropagation).toHaveBeenCalled();
    expect(typed.preventDefault).not.toHaveBeenCalled();
    for (const key of ["Enter", "Tab", "Escape"]) {
      const e = press(key, m.input);
      expect(e.stopPropagation).not.toHaveBeenCalled();
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
  });

  it("only the four keys mean an end of the list", () => {
    expect(menuJumpEdge("ArrowDown")).toBe("first");
    expect(menuJumpEdge("Home")).toBe("first");
    expect(menuJumpEdge("ArrowUp")).toBe("last");
    expect(menuJumpEdge("End")).toBe("last");
    for (const key of ["Enter", "Escape", "Tab", "a", "ArrowLeft", "PageDown"])
      expect(menuJumpEdge(key)).toBe(null);
  });
});
