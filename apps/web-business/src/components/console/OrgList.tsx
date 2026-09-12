import Link from "next/link";
import type { Organization } from "@/lib/api/organizations";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";
import { cn } from "@/lib/utils";

/** The 2+ organizations collection. Name, role, placeCount — never a
 *  Connect column: that needs a payment-account read per row. */
export function OrgList({
  organizations,
  activeId,
}: {
  organizations: Pick<Organization, "id" | "name" | "myRole" | "placeCount">[];
  activeId: string;
}) {
  return (
    <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border">
      {organizations.map((o) => {
        const active = o.id === activeId;
        const places =
          o.placeCount === 1 ? "1 place" : `${o.placeCount} places`;
        return (
          <li key={o.id}>
            <Link
              href={withOrg(SHELL_ROUTES.organization, o.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-between gap-4 px-4 py-3 text-sm transition",
                active ? "bg-muted font-medium" : "hover:bg-muted/60",
              )}
            >
              <span className="truncate font-medium">{o.name}</span>
              <span className="text-muted-foreground shrink-0 text-[13px]">
                <span className="capitalize">{o.myRole}</span>
                {" · "}
                {places}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
