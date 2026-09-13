"use client";

// The content column's header line (MESITA-1710). Breadcrumb left, route right.
//
// THIS IS WHERE THE ROUTE READOUT WENT. The console is driven in a chromeless
// desktop window, so the address bar — the one thing every browser gives you
// for free — is not on screen, and "which page is this, with which org?" had
// no answer anywhere in the product. The old top bar answered it; the rail
// cannot, because a 240px column has no room for a uuid.
//
// So the two halves of the question split by where they belong:
//   rail    what site is this, what section am I in
//   header  whose data am I looking at, and what exactly is this URL
//
// The crumb mirrors the rail's own nesting (MESITA-1807): the organization
// first, then the page — or the place, then its view — so the two chrome
// surfaces never disagree about where you are. Both read ONE scope
// (lib/use-rail-scope.ts), resolved once in AppShell.
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
  ORG_PAGE_LABEL,
  SHELL_ROUTES,
  orgPageFromPathname,
  placeIdFromPathname,
} from "@/lib/console-routes";
import { PLACE_TAB_LABEL, placeTabFromPathname } from "@/lib/place-tabs";
import type { RailScope } from "@/lib/rail-scope";
import { SHELL_GUTTER } from "@/lib/ui-classes";
import { useOpenPlace } from "@/components/console/OpenPlace";

/** The trail, as words. */
export function crumbsFor(
  pathname: string,
  names: { orgName: string | null; placeName: string | null },
): string[] {
  if (pathname === SHELL_ROUTES.account) return ["Account"];
  if (pathname === SHELL_ROUTES.orgNew) return ["Create organization"];
  const page = orgPageFromPathname(pathname);
  if (page) {
    const trail = [names.orgName ?? "Organization", ORG_PAGE_LABEL[page]];
    if (/\/places\/new\/?$/.test(pathname)) trail.push("Claim");
    return trail;
  }
  if (placeIdFromPathname(pathname)) {
    const trail = names.orgName ? [names.orgName] : [];
    trail.push(names.placeName ?? "Place");
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
  const crumbs = crumbsFor(pathname, {
    orgName: scope.org?.name ?? null,
    placeName,
  });

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
