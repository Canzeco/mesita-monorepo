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
// return has Stripe's pages under it), so the shell keeps its own depth:
// a move forward adds one, a browser Back (popstate) takes one away.

let depth = 0;
let popped = false;
let skipNextMove = false;

/** Install once on the client: marks the next move as a Back. */
export function listenForBack(): () => void {
  const onPop = () => {
    popped = true;
  };
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}

/** Count a pathname change (the shell calls this on every one after the first). */
export function noteInAppMove(): void {
  if (skipNextMove) {
    skipNextMove = false;
  } else if (popped) {
    depth = Math.max(0, depth - 1);
  } else {
    depth += 1;
  }
  popped = false;
}

/** Rewrite the address without a navigation: the screen already shows what
 *  the new address names (a door that opened a bill). Not a move. */
export function replaceAddress(href: string): void {
  if (`${window.location.pathname}${window.location.search}` === href) return;
  // Only a new pathname reaches noteInAppMove; a query-only rewrite must not
  // leave the skip armed for the next real move.
  if (new URL(href, window.location.href).pathname !== window.location.pathname) skipNextMove = true;
  window.history.replaceState(window.history.state, "", href);
}

/** Back to the screen under this one, or `fallback` (in place of this one)
 *  when this one was opened from outside the app. */
export function goBack(router: RouterLike & { back: () => void }, fallback: string): void {
  if (depth > 0) {
    router.back();
    return;
  }
  skipNextMove = true;
  router.replace(fallback);
}
