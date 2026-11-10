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

type NavigationLike = { currentEntry?: { index: number } | null };

function entryIndex(): number | null {
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  return nav?.currentEntry ? nav.currentEntry.index : null;
}

let shellEntry: number | null = null;

/** The shell's first entry: called once when the shell mounts. */
export function markShellEntry(): void {
  if (shellEntry === null) shellEntry = entryIndex();
}

/** Is there a screen of ours under this one? */
function hasInAppBack(): boolean {
  const at = entryIndex();
  if (at !== null && shellEntry !== null) return at > shellEntry;
  return window.history.length > 1;
}

/** Rewrite the address without a navigation: the screen already shows what
 *  the new address names (a door that opened a bill, a read Stripe event).
 *  Next takes a `null` state as its own replace (usePathname follows). */
export function replaceAddress(href: string): void {
  if (`${window.location.pathname}${window.location.search}` === href) return;
  window.history.replaceState(null, "", href);
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
