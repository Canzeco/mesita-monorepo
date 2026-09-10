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
import { SHELL_ROUTES, ownedFromParam } from "@/lib/console-routes";
import { SHELL_GUTTER } from "@/lib/ui-classes";
import { useActiveOrg, type ChromeOrg } from "@/lib/use-active-org";
import type { OpenPlace } from "@/components/console/OpenPlace";
import { useOpenPlace } from "@/components/console/OpenPlace";

/** The trail, as words. Mirrors the rail's own nesting so the two chrome
 *  surfaces never disagree about where you are. */
export function crumbsFor(
  pathname: string,
  owned: "org" | "public" | null,
  openPlace: OpenPlace | null,
): string[] {
  if (pathname === SHELL_ROUTES.account) return ["Account"];
  if (pathname === SHELL_ROUTES.organization) return ["Organization"];
  if (pathname === SHELL_ROUTES.places) {
    if (owned === "org") return ["Places", "Org Places"];
    if (owned === "public") return ["Places", "Public Places"];
    return ["Places"];
  }
  if (pathname.startsWith(`${SHELL_ROUTES.places}/`)) {
    const parent = openPlace?.owned === false ? "Public Places" : "Org Places";
    return ["Places", parent, openPlace?.name ?? "Place"];
  }
  return [];
}

export function ConsoleHeader({
  organizations,
}: {
  organizations: ChromeOrg[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.toString();
  const openPlace = useOpenPlace();
  // The NAME is resolved here, from ?org=, not handed down pre-resolved. A
  // server layout cannot read searchParams, so a passed-in name is always
  // `organizations[0]` — and this line's entire job is to say whose data is on
  // screen, so getting that wrong is worse than not printing it at all.
  const { activeOrg } = useActiveOrg(organizations);
  const orgName = activeOrg?.name ?? null;

  // What the address bar would have said. The query rides along because ?org=
  // is the half that says WHOSE screen this is — a bare /places is ambiguous
  // the moment an account holds two organizations.
  const route = q ? `${pathname}?${q}` : pathname;
  const crumbs = crumbsFor(pathname, ownedFromParam(searchParams.get("owned")), openPlace);

  return (
    // A <div>, not a <header>: the rail is already this document's banner
    // landmark and there may only be one.
    <div
      className={`border-border bg-background flex h-11 shrink-0 items-center gap-3 border-b ${SHELL_GUTTER}`}
    >
      <p className="text-muted-foreground min-w-0 truncate text-[13px]">
        {orgName && <span className="text-foreground font-medium">{orgName}</span>}
        {crumbs.map((c, i) => (
          <span key={c + i}>
            {(i > 0 || orgName) && <span className="px-1.5 opacity-50">/</span>}
            <span className={i === crumbs.length - 1 ? "text-foreground font-medium" : ""}>
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
