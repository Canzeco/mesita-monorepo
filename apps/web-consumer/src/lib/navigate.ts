// EVERY IN-APP MOVE GOES THROUGH HERE (MESITA-2824). On the live Search map
// a client push sometimes never commits: the tab lit, the card was tapped,
// and the map stayed "even when I wait" (Pato). MESITA-2772, 2780 and 2816
// each fixed a piece blind; the push that never lands is still unexplained,
// so this is the guard that makes it not matter.
//
// Two guards. The push goes to the URL the guest's surface serves
// (/web/place/…), as the bottom bar's taps do since MESITA-2772, not the bare
// /place/… the proxy would have to redirect. And when the address has not
// moved after NAV_FALLBACK_MS, the screen loads as a page at that URL: a
// client navigation stuck behind another never leaves the guest on a dead
// tap. The fallback says so on the console with where it was and where it
// went, so the next report carries the evidence the fix never had.

import { prefixPath, surfaceOf } from "@/lib/surface";

/** Long enough for a slow push to commit its loading frame (an Oregon
 *  round trip is about a second), short enough that a dead tap still reads
 *  as a slow one. It was 2500 on place opens only (MESITA-2816). */
export const NAV_FALLBACK_MS = 1500;

type RouterLike = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

/** Push (or replace) `href` on the guest's surface, and hard-load it if the
 *  address has not moved after NAV_FALLBACK_MS. */
export function navigateTo(
  router: RouterLike,
  href: string,
  { replace = false }: { replace?: boolean } = {},
): void {
  const from = window.location.pathname;
  const target = prefixPath(surfaceOf(from) ?? "web", href);
  if (replace) router.replace(target);
  else router.push(target);
  window.setTimeout(() => {
    if (window.location.pathname !== from) return;
    console.warn("[nav] push never committed; loading the page", {
      from,
      to: target,
      replace,
    });
    // A replace keeps history poppable: the stuck screen must not become
    // a Back stop under the one that loads.
    if (replace) window.location.replace(target);
    else window.location.assign(target);
  }, NAV_FALLBACK_MS);
}
