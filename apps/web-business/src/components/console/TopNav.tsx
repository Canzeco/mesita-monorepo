"use client";

// The whole navigation: one slim bar, four screens, and the organization
// switcher. Client because active state needs usePathname and every href
// carries the active organization.
//
// Three of the four are always there. Place is the fourth and it needs an
// id, so it appears only while you have one open — and it takes the
// active state off Places, which `/places/<id>` would otherwise steal
// by prefix.
//
// The bar also NAMES THE ROUTE. The console is driven in a chromeless
// desktop window, so the address bar — the one thing every browser gives
// you for free — is not on screen, and "which page is this, with which
// org?" had no answer anywhere in the product.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import {
  SHELL_ROUTES,
  placeHref,
  placeIdFromPathname,
  withOrg,
} from "@/lib/console-routes";
import { SHELL_GUTTER } from "@/lib/ui-classes";
import type { Organization } from "@/lib/api/organizations";

const LINKS = [
  { label: "Account", href: SHELL_ROUTES.account },
  { label: "Organization", href: SHELL_ROUTES.organization },
  // One list since MESITA-1614: what this org holds and what it can claim,
  // told apart by the Owned column rather than by two screens.
  { label: "Places", href: SHELL_ROUTES.places },
];

export function TopNav({
  organizations,
}: {
  organizations: Pick<Organization, "id" | "name">[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.toString();

  // The active organization is resolved HERE, not passed down: the layout
  // that renders this cannot read searchParams, so it would have had to
  // guess. Same fallback rule the pages use — ?org= when it names one you
  // belong to, else the first.
  const requested = searchParams.get("org");
  const activeOrgId =
    (requested && organizations.some((o) => o.id === requested)
      ? requested
      : organizations[0]?.id) ?? null;

  // Exact, not prefix: /places/<id> is Place, not Org Places.
  const openPlaceId = placeIdFromPathname(pathname);
  const isActive = (href: string) => pathname === href;

  // What the address bar would have said. The query rides along because
  // ?org= is the half that says WHOSE screen this is — a bare /places is
  // ambiguous the moment an account holds two organizations.
  const route = q ? `${pathname}?${q}` : pathname;

  // Switching organization keeps you on the screen you are looking at —
  // the same list, a different portfolio.
  const switchHref = (id: string) => {
    const params = new URLSearchParams(q);
    params.set("org", id);
    return `${pathname}?${params.toString()}`;
  };

  return (
    // STATIC below `sm`, sticky above it. Two stacked sticky bars cost 104px
    // of a ~635px phone viewport before any content, on the one screen whose
    // job is a form taller than the viewport. What an operator needs pinned
    // while scrolling that form is the place's tab rail, not the wordmark —
    // so row 2 sticks at every size and row 1 yields on phones.
    <header className="border-border bg-background static z-30 border-b sm:sticky sm:top-0">
      <div className={`flex h-14 w-full items-center gap-4 ${SHELL_GUTTER}`}>
        <Link href={withOrg("/", activeOrgId)} aria-label="Organization">
          <MesitaLogo variant="horizontal" className="h-6 w-auto shrink-0" />
        </Link>

        <nav
          className="flex min-w-0 items-center gap-0.5 overflow-x-auto"
          aria-label="Console"
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={withOrg(l.href, activeOrgId)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm transition",
                isActive(l.href)
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
          {openPlaceId && (
            // A LINK, not a span. This was the only nav item you could not
            // click, and it is the sixth of six. It stays the short word
            // "Place": row 1 is the ALWAYS header, and an entry whose width
            // changes per route destabilises it — a Google-sourced name like
            // "Restaurante El Rincon de la Abuela - Sucursal Polanco II"
            // would push the org switcher off screen and truncate to mush.
            // Row 2 carries the real name, next to that place's own menu.
            <Link
              href={withOrg(placeHref(openPlaceId), activeOrgId)}
              aria-current="page"
              className="bg-foreground text-background shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold"
            >
              Place
            </Link>
          )}
        </nav>

        {/* WHERE YOU ARE. A Link, not a span: an anchor is what makes the
            browser's own "copy link address" work, which is most of the point
            of seeing a route at all. It targets the current route, so
            following it is a no-op rather than a navigation.

            WIDTH-STABLE BY CONSTRUCTION. Row 1 is the ALWAYS header and an
            entry whose width changes per route destabilises it — the same
            rule that keeps the Place pill the short word "Place". A place
            route carries a uuid and runs past 50 characters, so this truncates
            inside a fixed max-width and hands the whole string to `title`.
            Hidden below `sm`, where a real address bar exists. */}
        <Link
          href={route}
          title={route}
          aria-label={`Current route: ${route}`}
          className="text-muted-foreground/80 hover:text-foreground ml-auto hidden max-w-[20rem] shrink-0 truncate font-mono text-[11px] transition select-all sm:block"
        >
          {route}
        </Link>

        {organizations.length > 1 && (
          <select
            aria-label="Switch organization"
            defaultValue={activeOrgId ?? ""}
            onChange={(e) => {
              window.location.href = switchHref(e.target.value);
            }}
            className="border-border bg-card hidden max-w-[12rem] shrink-0 truncate rounded-full border px-3 py-1.5 text-[12px] sm:block"
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </header>
  );
}
