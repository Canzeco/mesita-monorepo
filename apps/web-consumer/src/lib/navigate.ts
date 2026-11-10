// EVERY IN-APP MOVE GOES THROUGH HERE (MESITA-2824). Since MESITA-3013 the
// app is served at its real paths (no /web or /mob rewrite), so a push is a
// plain Next navigation: the Link prefetch and the push name the same URL,
// the router cache answers, and the target's loading.tsx paints at once.
//
// The 1.5 s "push never committed → reload the page" guard is gone with the
// rewrite that made pushes miss. A full reload threw away every cache and
// re-ran the shell's two Oregon reads, so a slow tap became the slowest
// possible navigation.

type RouterLike = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

/** Push (or replace) `href`. */
export function navigateTo(
  router: RouterLike,
  href: string,
  { replace = false }: { replace?: boolean } = {},
): void {
  if (replace) router.replace(href);
  else router.push(href);
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

/** Back to the screen under this one, or `fallback` (in place of this one)
 *  when this one was opened from outside the app. */
export function goBack(router: RouterLike & { back: () => void }, fallback: string): void {
  if (hasInAppBack()) router.back();
  else router.replace(fallback);
}
