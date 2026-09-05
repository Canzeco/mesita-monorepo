// Places: one row per address. Rows, not cards. Commercial has no place
// column on purpose — nothing here edits a price.
import Link from "next/link";
import { Store } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { RungBadge } from "@/components/console/badges";
import { getOrg, resolveOrgKey } from "@/lib/mock";
import { placePath, withOrg } from "@/lib/console-routes";
import { CTA_BUTTON_CLASS } from "@/lib/ui-classes";

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const orgKey = resolveOrgKey(sp.org);
  const data = getOrg(sp.org);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Places
      </h1>
      {data.places.length === 0 ? (
        <EmptyState
          icon={<Store className="text-muted-foreground h-5 w-5" />}
          title="No places yet"
          description="Claim your first place to open the doors — profile, reservations and the check page come with it."
          action={
            <button type="button" className={CTA_BUTTON_CLASS} disabled>
              Add a place (soon)
            </button>
          }
        />
      ) : (
        <div className="border-border bg-card rounded-2xl border px-4">
          {data.places.map((p) => (
            <Link
              key={p.id}
              href={withOrg(placePath(p.id), orgKey)}
              className="border-border/60 hover:bg-muted/40 -mx-4 flex items-center justify-between gap-3 border-b px-4 py-3.5 transition last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="text-muted-foreground truncate text-[12px]">
                  {p.address}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-muted-foreground text-[12px]">
                  {p.coversToday} covers today
                </span>
                <RungBadge
                  rung={
                    data.organization.rung === "partner"
                      ? "partner"
                      : p.verified
                        ? "verified"
                        : "listed"
                  }
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
