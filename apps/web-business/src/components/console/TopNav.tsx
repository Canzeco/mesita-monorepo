"use client";

// The whole navigation: one slim bar, three entity layers. Client because
// active state needs usePathname and every href carries the ?org= switch.
// Never imports lib/supabase or lib/api (test-enforced).
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MockChip } from "@/components/console/badges";
import { ORGS, resolveOrgKey } from "@/lib/mock";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";

const LINKS = [
  { label: "Organization", href: SHELL_ROUTES.organization },
  { label: "Places", href: SHELL_ROUTES.places },
  { label: "Account", href: SHELL_ROUTES.account },
];

export function TopNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgKey = resolveOrgKey(searchParams.get("org") ?? undefined);
  const otherKey = orgKey === "grupo-ruiz" ? "nuevo" : "grupo-ruiz";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="border-border bg-background sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-5 px-4">
        <MesitaLogo variant="horizontal" className="h-6 w-auto shrink-0" />
        <nav className="flex items-center gap-1" aria-label="Console">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={withOrg(l.href, orgKey)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition",
                isActive(l.href)
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={withOrg("/", otherKey)}
            className="text-muted-foreground hover:text-foreground hidden text-[12px] transition sm:block"
            title={`Switch to ${ORGS[otherKey].organization.name}`}
          >
            {ORGS[orgKey].organization.name} · Switch
          </Link>
          <MockChip />
        </div>
      </div>
    </header>
  );
}
