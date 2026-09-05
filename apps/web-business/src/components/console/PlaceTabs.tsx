"use client";

// Tab row for /places/[id] — tabs are LINKS to nested routes (URL-
// addressable, testable), never client state. Preserves the ?org= switch.
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { PLACE_TABS, placePath, withOrg } from "@/lib/console-routes";
import { resolveOrgKey } from "@/lib/mock";

const TAB_LABEL: Record<(typeof PLACE_TABS)[number], string> = {
  profile: "Profile",
  services: "Services",
  status: "Status",
};

export function PlaceTabs() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgKey = resolveOrgKey(searchParams.get("org") ?? undefined);

  return (
    <div className="border-border flex gap-1 border-b" role="tablist">
      {PLACE_TABS.map((tab) => {
        const href = placePath(params.id, tab);
        const active = pathname === href;
        return (
          <Link
            key={tab}
            href={withOrg(href, orgKey)}
            className={cn(
              "-mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm transition",
              active
                ? "border-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {TAB_LABEL[tab]}
          </Link>
        );
      })}
    </div>
  );
}
