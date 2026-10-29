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
