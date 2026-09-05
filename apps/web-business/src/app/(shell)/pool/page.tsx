// Public Places — the pool. Every place starts here; an organization
// claims one and it moves to Org Places.
//
// Ownership verification is out of scope for now, so a claim is an
// assertion. The server is what enforces it: the pool predicate is shared
// with business-web-claim-place, so a place this list hides cannot be
// claimed by guessing its id.
import { Search, Store } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageErrorState } from "@/components/business/PageErrorState";
import { PlaceRow } from "@/components/console/PlaceRow";
import { NoOrganization } from "@/components/console/NoOrganization";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiListConsolePlaces,
  apiListOrganizations,
  type ConsolePlace,
} from "@/lib/api/organizations";
import { canClaim, resolveActiveOrg } from "@/lib/active-organization";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";
import { INPUT_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PublicPlacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q : "";

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/pool");

  const orgs = await apiListOrganizations(supabase).catch(() => []);
  const org = resolveActiveOrg(orgs, sp.org);
  if (!org) {
    return (
      <>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Public Places
        </h1>
        <NoOrganization />
      </>
    );
  }

  let places: ConsolePlace[] = [];
  let error: string | null = null;
  try {
    places = await apiListConsolePlaces(supabase, { scope: "public", query });
  } catch (e) {
    error = errMsg(e, "Couldn't load the public pool.");
  }

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Public Places
        </h1>
        <p className="text-muted-foreground text-[13px]">
          Not held by any organization. Claim into {org.name}.
        </p>
      </div>

      <form action={SHELL_ROUTES.pool} className="relative">
        <input type="hidden" name="org" value={org.id} />
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name..."
          aria-label="Search public places"
          className={cn(INPUT_CLASS, "pl-9")}
        />
      </form>

      {error ? (
        <PageErrorState
          heading="Couldn't load the pool"
          message={error}
          retryHref={withOrg(SHELL_ROUTES.pool, org.id)}
        />
      ) : places.length === 0 ? (
        <EmptyState
          icon={<Store className="text-muted-foreground h-5 w-5" />}
          title={query ? "No places match that" : "The pool is empty"}
          description={
            query
              ? "Try a different name, or clear the search."
              : "Every place is held by an organization right now."
          }
        />
      ) : (
        <div className="border-border bg-card rounded-2xl border px-4">
          {places.map((p) => (
            <PlaceRow
              key={p.id}
              place={p}
              action="claim"
              organizationId={org.id}
              allowed={canClaim(org.myRole)}
            />
          ))}
        </div>
      )}
    </>
  );
}
