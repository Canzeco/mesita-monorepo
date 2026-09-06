"use client";

// The whole navigation: one slim bar, five screens, and the organization
// switcher. Client because active state needs usePathname and every href
// carries the active organization.
//
// Four of the five are always there. Place is the fifth and it needs an
// id, so it appears only while you have one open — and it takes the
// active state off Org Places, which `/places/<id>` would otherwise steal
// by prefix.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import {
  SHELL_ROUTES,
  placeIdFromPathname,
  withOrg,
} from "@/lib/console-routes";
import type { Organization } from "@/lib/api/organizations";

const LINKS = [
  { label: "Account", href: SHELL_ROUTES.account },
  { label: "Organization", href: SHELL_ROUTES.organization },
  { label: "Org Places", href: SHELL_ROUTES.places },
  { label: "Public Places", href: SHELL_ROUTES.pool },
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

  // Switching organization keeps you on the screen you are looking at —
  // the same list, a different portfolio.
  const switchHref = (id: string) => {
    const params = new URLSearchParams(q);
    params.set("org", id);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <header className="border-border bg-background sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
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
            <span
              aria-current="page"
              className="bg-foreground text-background shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold"
            >
              Place
            </span>
          )}
        </nav>

        {organizations.length > 1 && (
          <select
            aria-label="Switch organization"
            defaultValue={activeOrgId ?? ""}
            onChange={(e) => {
              window.location.href = switchHref(e.target.value);
            }}
            className="border-border bg-card ml-auto hidden max-w-[12rem] shrink-0 truncate rounded-full border px-3 py-1.5 text-[12px] sm:block"
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
