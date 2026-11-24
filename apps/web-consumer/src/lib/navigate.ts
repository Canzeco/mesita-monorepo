// EVERY IN-APP MOVE GOES THROUGH HERE (MESITA-2824). Since MESITA-3013 the
// app is served at its real paths (no /web or /mob rewrite), so a push is a
// plain Next navigation: the Link prefetch and the push name the same URL,
// the router cache answers, and the target's loading.tsx paints at once.
//
// The 1.5 s "push never committed → reload the page" guard is gone with the
// rewrite that made pushes miss. A full reload threw away every cache and
// re-ran the shell's two Oregon reads, so a slow tap became the slowest
// possible navigation.

import { isModalContractPath, parentHref } from "./consumer-route-contract";

type NavOptions = { transitionTypes?: string[] };

type RouterLike = {
  push: (href: string, options?: NavOptions) => void;
  replace: (href: string, options?: NavOptions) => void;
};

// ─── Motion ────────────────────────────────────────────────────────────────
//
// GOING IN SLIDES, COMING BACK SLIDES AWAY (Pato, 2026-11-10, MESITA-3644:
// "when navigating across nested pages (not bottom menu) … the new view
// slides from right to left on top of old screen … like in instagram"). A
// navigation that carries `nav-push` makes ScreenStage (components/consumer/
// nav) slide the new screen in from the right over a picture of the old one;
// `nav-pop` slides the screen away to the right. A navigation with no type
// (a bar tab, Home's Places/Social, a redirect, a screen replacing itself)
// swaps with no motion, as before.

/** The transition type a drill-in carries. */
export const NAV_PUSH = "nav-push";
/** The transition type a Back carries. */
export const NAV_POP = "nav-pop";

export type Motion = "push" | "pop" | "none";

/** The motion a tap from `from` (a pathname) to `to` (an href) plays. A
 *  panel opened over a page (a place, a reservation, Ask AI) slides itself
 *  in, so the screen under it stays still; every other drill-in slides. */
export function motionFor(from: string, to: string): Motion {
  const toPath = to.split(/[?#]/)[0] ?? to;
  if (isModalContractPath(toPath) && !isModalContractPath(from)) return "none";
  return "push";
}

/** Next's `transitionTypes` for a motion. */
export function transitionTypesFor(motion: Motion): string[] | undefined {
  if (motion === "push") return [NAV_PUSH];
  if (motion === "pop") return [NAV_POP];
  return undefined;
}

/** Push (or replace) `href`. `motion` says how the screen moves: none by
 *  default (a tab, a redirect, a screen replacing itself); "drill" for a
 *  drill-in, which slides unless it opens a panel over a page (motionFor). */
export function navigateTo(
  router: RouterLike,
  href: string,
  {
    replace = false,
    motion = "none",
  }: { replace?: boolean; motion?: Motion | "drill" } = {},
): void {
  const move: Motion =
    motion === "drill" ? motionFor(window.location.pathname, href) : motion;
  if (move !== "none") noteTraverse(false);
  const types = transitionTypesFor(move);
  const go = replace ? router.replace : router.push;
  if (types) go.call(router, href, { transitionTypes: types });
  else go.call(router, href);
}

// ─── History moves ─────────────────────────────────────────────────────────
//
// Back and Forward (the screen's Back, the phone's Back, a swipe) reach Next
// as a popstate with no transition type. ScreenStage tags it and records it
// here, so a panel that a Back restores (the place under Reserve) shows at
// once instead of sliding in a second time. The next tap clears it.

let traversed = false;

/** Record whether the newest move was a history move (Back or Forward). */
export function noteTraverse(value: boolean): void {
  traversed = value;
}

/** Was the newest move a history move? */
export function lastMoveWasTraverse(): boolean {
  return traversed;
}

// A panel's own close (its chevron, backdrop or Esc) slides the panel out
// and then goes Back. That Back must not slide the screen as well.
let panelExit = false;

/** A panel slid itself out; the Back that follows plays no screen motion. */
export function markPanelExit(): void {
  panelExit = true;
}

/** Read and clear the panel-exit mark. */
export function takePanelExit(): boolean {
  const was = panelExit;
  panelExit = false;
  return was;
}

// ─── Back ──────────────────────────────────────────────────────────────────
//
// BACK GOES WHERE YOU CAME FROM (MESITA-3614). A screen reached from inside
// the app (a receipt from Wallet or Me, a bill from a place) closes onto the
// screen under it; one opened cold (a table QR, a Stripe return, a shared
// link) has nothing of ours under it, so it lands on its tab instead of
// leaving the app. `window.history.length` cannot tell those apart (a Stripe
// return has Stripe's pages under it), so where the browser has the
// Navigation API, Back compares the current entry's index with the entry the
// shell first loaded on: a replace keeps the index, a Back lowers it. Without
// that API it falls back to `history.length`, as before.

type NavigationLike = {
  currentEntry?: { index: number; url?: string; key?: string } | null;
  entries?: () => Array<{ url?: string; key?: string }>;
};

function navigation(): NavigationLike | undefined {
  return (window as unknown as { navigation?: NavigationLike }).navigation;
}

function entryIndex(): number | null {
  const nav = navigation();
  return nav?.currentEntry ? nav.currentEntry.index : null;
}

let shellEntry: number | null = null;

// A RELOAD KEEPS THE TRAIL (MESITA-4602). `shellEntry` is module state, so a
// reload (pull to refresh, the deploy reload) used to reset it to the entry
// reloaded on, and Back then left for the screen's parent with the guest's
// earlier screens stranded under it. The index is kept for the tab, and a
// document that arrives by a reload, or by the browser's Back or Forward,
// takes it back: its history is the same trail.
//
// A FULL LOAD KEEPS IT TOO (MESITA-4622, Pato: "the routing breaks when much
// navigating"). Next turns a tap into a full page load when the page's read
// fails or answers from a newer deploy; that document arrives by a plain
// navigation, so it used to start a new trail, and its "<" fell to its
// parent (Prepay → Offers → card → "<" → "<" landed on the place profile).
// The app now remembers which history entries it showed (their Navigation
// API keys, per tab): a plain load continues the trail when the entry under
// it is one the app showed. A table QR in a new tab, a Stripe return or a
// link from another site has none of ours under it and starts a new trail,
// as before. A sign-in forgets the trail (`forgetTrail`), so Back never
// reaches the previous guest's screens.
const SHELL_ENTRY_KEY = "mesita.shell-entry";
const SHOWN_ENTRIES_KEY = "mesita.shown-entries";
const SHOWN_ENTRIES_MAX = 200;

/** The shell entry this document starts with: the tab's kept one when this
 *  load continues the same trail and the kept entry is not above it. A
 *  reload or a Back/Forward load continues it; a plain load does only when
 *  the entry under it is one the app showed. */
export function shellEntryFor(
  current: number | null,
  kept: number | null,
  arrivedBy: string | null,
  underIsOurs: boolean,
): number | null {
  if (current === null) return null;
  const sameTrail =
    arrivedBy === "reload" || arrivedBy === "back_forward" || (arrivedBy === "navigate" && underIsOurs);
  return sameTrail && kept !== null && kept <= current ? kept : current;
}

function readKeptShellEntry(): number | null {
  try {
    const raw = window.sessionStorage.getItem(SHELL_ENTRY_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function readShownEntries(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(SHOWN_ENTRIES_KEY) ?? "[]");
    return Array.isArray(parsed) && parsed.every((k) => typeof k === "string") ? parsed : [];
  } catch {
    return [];
  }
}

/** Remember that the app showed the current history entry (newest last,
 *  the newest 200 kept). Called on every push and replace. */
export function noteShownEntry(): void {
  const key = navigation()?.currentEntry?.key;
  if (!key) return;
  const keys = readShownEntries().filter((k) => k !== key);
  keys.push(key);
  try {
    window.sessionStorage.setItem(SHOWN_ENTRIES_KEY, JSON.stringify(keys.slice(-SHOWN_ENTRIES_MAX)));
  } catch {
    // Storage off (private mode): a full load starts a new trail, as before.
  }
}

/** Was the history entry under this one shown by the app? */
function entryUnderIsOurs(): boolean {
  const nav = navigation();
  const index = nav?.currentEntry?.index;
  const entries = nav?.entries?.();
  if (index == null || !entries || index < 1) return false;
  const key = entries[index - 1]?.key;
  return !!key && readShownEntries().includes(key);
}

function arrivedBy(): string | null {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return nav?.type ?? null;
  } catch {
    return null;
  }
}

/** The shell's first entry: marked once, and again after `forgetTrail`. */
export function markShellEntry(): void {
  if (shellEntry !== null) return;
  shellEntry = shellEntryFor(entryIndex(), readKeptShellEntry(), arrivedBy(), entryUnderIsOurs());
  if (shellEntry === null) return;
  try {
    window.sessionStorage.setItem(SHELL_ENTRY_KEY, String(shellEntry));
  } catch {
    // Storage off (private mode): the entry lasts the document, as before.
  }
}

/** A sign-in starts a new trail: the earlier screens belong to whoever was
 *  signed in before. The next screen marks itself as the first. */
export function forgetTrail(): void {
  shellEntry = null;
  try {
    window.sessionStorage.removeItem(SHELL_ENTRY_KEY);
    window.sessionStorage.removeItem(SHOWN_ENTRIES_KEY);
  } catch {
    // Storage off: nothing was kept.
  }
}

/** The pathname of the history entry under this one, when the browser
 *  exposes the Navigation API. Null when it does not, or this is the first entry. */
export function previousEntryPath(): string | null {
  const nav = navigation();
  const index = nav?.currentEntry?.index;
  const entries = nav?.entries?.();
  if (index == null || !entries || index < 1) return null;
  const url = entries[index - 1]?.url;
  if (!url) return null;
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return null;
  }
}

/** Is there a screen of ours under this one? */
export function hasInAppBack(): boolean {
  const at = entryIndex();
  // With the Navigation API, an unmarked trail (just after a sign-in) has
  // nothing of ours under it yet: never fall back to history.length there.
  if (at !== null) return shellEntry !== null && at > shellEntry;
  return window.history.length > 1;
}

/** Rewrite the address without a navigation: the screen already shows what
 *  the new address names (a door that opened a bill, a read Stripe event).
 *  Next takes a `null` state as its own replace (usePathname follows). */
export function replaceAddress(href: string): void {
  if (`${window.location.pathname}${window.location.search}` === href) return;
  window.history.replaceState(null, "", href);
}

/** A `?return=` path back into this app (MESITA-4112). Anything that is not
 *  one absolute path is dropped: a protocol, a protocol-relative URL, a
 *  backslash, or an encoded slash that decodes into one of those. */
export function safeReturn(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const raw = v.trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) return null;
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("://")) return null;
  if (/^\/\s*javascript:/i.test(path)) return null;
  return path;
}

/** Back to the screen under this one, or, when this one was opened from
 *  outside the app, to `fallback`: by default the route map's parent of this
 *  screen (a bill → Pay, Reserve → its place, a reservation → Me ›
 *  Reservations, MESITA-3646). */
export function goBack(
  router: RouterLike & { back: () => void },
  fallback?: string,
): void {
  if (hasInAppBack()) router.back();
  else
    navigateTo(router, fallback ?? parentHref(window.location.pathname), {
      replace: true,
      motion: "pop",
    });
}

/** The Navigation API index of the current entry, when the browser has it
 *  (ScreenStage reads it to tell Back from Forward). */
export function currentEntryIndex(): number | null {
  return entryIndex();
}
