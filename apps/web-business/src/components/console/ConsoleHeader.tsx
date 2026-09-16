"use client";

// The content column's header line (MESITA-1710). Breadcrumb left, route right.
//
// THIS IS WHERE THE ROUTE READOUT WENT. The console is driven in a chromeless
// desktop window, so the address bar — the one thing every browser gives you
// for free — is not on screen, and "which page is this, about which place?"
// had no answer anywhere in the product. The old top bar answered it; the rail
// cannot, because a 240px column has no room for a uuid.
//
// So the two halves of the question split by where they belong:
//   rail    what site is this, what section am I in
//   header  whose data am I looking at, and what exactly is this URL
//
// The crumb mirrors the rail's own nesting (MESITA-1807): the place, then the
// page or view it is showing — so the two chrome surfaces never disagree about
// where you are. Both read ONE scope (lib/use-rail-scope.ts), resolved once in
// AppShell.
//
// ONE SUBJECT (MESITA-1892). The trail used to open with the ORGANIZATION and
// then name the place under it; there is no organization, so the place is the
// first crumb on every address that has one.
//
// A Link, not a span: an anchor is what makes the browser's own "copy link
// address" work, which is most of the point of seeing a route at all. It
// targets the current route, so following it is a no-op rather than a
// navigation.
//
// WIDTH-STABLE BY CONSTRUCTION. A place route carries a uuid and runs past 50
// characters, so it truncates inside a fixed max-width and hands the whole
// string to `title`. Hidden below `lg`, where a real address bar exists.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  PLACE_PAGE_LABEL,
  SHELL_ROUTES,
  flatPlacePageFromPathname,
  flatViewFromPathname,
  placeIdFromPathname,
  placePageFromPathname,
} from "@/lib/console-routes";
import { PLACE_TAB_LABEL, placeTabFromPathname } from "@/lib/place-tabs";
import type { RailScope } from "@/lib/rail-scope";
import { SHELL_GUTTER } from "@/lib/ui-classes";
import { useOpenPlace } from "@/components/console/OpenPlace";

/** The trail, as words. */
export function crumbsFor(
  pathname: string,
  names: { placeName: string | null },
): string[] {
  if (pathname === SHELL_ROUTES.account) return ["Account"];
  // The catalogue is about no ONE place, which is why it sits above them all.
  if (pathname === SHELL_ROUTES.places) return ["Places"];
  if (pathname === SHELL_ROUTES.placesNew) return ["Places", "Add"];

  // The flat addresses (MESITA-1832, resolvers since MESITA-1839): they name
  // no subject, so the crumb supplies the one the shell resolved.
  const flatView = flatViewFromPathname(pathname);
  const flatPage = flatPlacePageFromPathname(pathname);
  const flat = flatView
    ? PLACE_TAB_LABEL[flatView]
    : flatPage
      ? PLACE_PAGE_LABEL[flatPage]
      : null;
  if (flat) {
    return [...(names.placeName ? [names.placeName] : []), flat];
  }

  if (placeIdFromPathname(pathname)) {
    const trail = [names.placeName ?? "Place"];
    const page = placePageFromPathname(pathname);
    if (page) {
      trail.push(PLACE_PAGE_LABEL[page]);
      // Mesita Payments' setup is the ONE sub-step left (MESITA-1900 retired
      // Terminal's), and it reads as its own page so the rail's Products row
      // stays lit while you stand in it. The segment is `pay` and the crumb
      // says Payments: the label moved, the address did not.
      if (/\/products\/pay\/?$/.test(pathname)) trail.push("Mesita Payments");
      return trail;
    }
    const view = placeTabFromPathname(pathname);
    if (view) trail.push(PLACE_TAB_LABEL[view]);
    return trail;
  }
  return [];
}

export function ConsoleHeader({ scope }: { scope: RailScope }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.toString();
  const openPlace = useOpenPlace();

  // The place's name comes from the scope when the place is held, and from
  // the place layout's publish when it is not (a pool place).
  const placeName =
    scope.placeIsCurrent && scope.place
      ? scope.place.name
      : openPlace?.id === scope.foreignPlaceId
        ? openPlace.name
        : null;
  const crumbs = crumbsFor(pathname, { placeName });

  // What the address bar would have said. The query rides along: `?owned=`
  // and `?connect=` are half the answer on the pages that read them.
  const route = q ? `${pathname}?${q}` : pathname;

  return (
    // A <div>, not a <header>: the rail is already this document's banner
    // landmark and there may only be one.
    <div
      className={`border-border bg-background flex h-11 shrink-0 items-center gap-3 border-b ${SHELL_GUTTER}`}
    >
      <p className="text-muted-foreground min-w-0 truncate text-[13px]">
        {crumbs.map((c, i) => (
          <span key={c + i}>
            {i > 0 && <span className="px-1.5 opacity-50">/</span>}
            <span
              className={
                i === crumbs.length - 1 ? "text-foreground font-medium" : ""
              }
            >
              {c}
            </span>
          </span>
        ))}
      </p>

      <Link
        href={route}
        title={route}
        aria-label={`Current route: ${route}`}
        className="text-muted-foreground hover:text-foreground ml-auto hidden max-w-[22rem] shrink-0 truncate font-mono text-[11px] transition select-all lg:block"
      >
        {route}
      </Link>
    </div>
  );
}
