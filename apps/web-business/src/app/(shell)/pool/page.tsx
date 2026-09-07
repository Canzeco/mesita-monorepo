// Public Places — the pool. Every place starts here; an organization
// claims one and it moves to Org Places.
//
// Ownership verification is out of scope for now, so a claim is an
// assertion. The server is what enforces it: the pool predicate is shared
// with business-web-claim-place, so a place this list hides cannot be
// claimed by guessing its id.
import { Search, Store } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageErrorState } from "@/components/business/PageErrorState";
import { PlaceHoldButton } from "@/components/console/PlaceHoldButton";
import { PlaceStatesTable } from "@/components/console/PlaceStatesTable";
import { NoOrganization } from "@/components/console/NoOrganization";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiListConsolePlaces,
  apiListOrganizations,
  type ConsolePlace,
} from "@/lib/api/organizations";
import { canClaim, resolveActiveOrg } from "@/lib/active-organization";
import { SHELL_ROUTES, placeHref, withOrg } from "@/lib/console-routes";
import { CTA_BUTTON_CLASS, INPUT_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
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
  // `hasAnyPlaces` separates "the pool is empty" from "there are no places at
  // all" — two different sentences and two different next steps. Only asked
  // when the pool came back empty AND no search narrowed it, so the ordinary
  // path still issues exactly one request.
  let hasAnyPlaces = true;
  try {
    places = await apiListConsolePlaces(supabase, { scope: "public", query });
    if (places.length === 0 && !query) {
      const orgPlaces = await apiListConsolePlaces(supabase, {
        scope: "org",
        organizationId: org.id,
      }).catch(() => []);
      hasAnyPlaces = orgPlaces.length > 0;
    }
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
        /* THREE empty states, not two. "The pool is empty" used to explain
           itself with "Every place is held by an organization right now",
           which is only true when the catalog HAS places — and with an empty
           catalog that sentence tells the only person who can see this screen
           something false, on the only screen they can see, with no next step.
           A terminal screen that lies is the worst state in the console. */
        <EmptyState
          icon={<Store className="text-muted-foreground h-5 w-5" />}
          title={
            query
              ? "No places match that"
              : hasAnyPlaces
                ? "The pool is empty"
                : "No places yet"
          }
          description={
            query
              ? "Try a different name, or clear the search."
              : hasAnyPlaces
                ? "Every place is held by an organization right now."
                : "The catalogue has no places yet. Add one and it lands here, claimable by any organization."
          }
          action={
            query ? (
              <Link
                href={withOrg(SHELL_ROUTES.pool, org.id)}
                className={CTA_BUTTON_CLASS}
              >
                Clear the search
              </Link>
            ) : (
              <Link href="/add" className={CTA_BUTTON_CLASS}>
                Add a place
              </Link>
            )
          }
        />
      ) : (
        /* No intake block. `getAuthedUser` accepts ANY valid bearer token and
           the backend is a singleton, so every consumer account can reach
           this scope — per-function pipeline state for places nobody holds is
           not theirs to read. The EF withholds it; the table just renders
           what it is given. */
        <PlaceStatesTable
          places={places}
          organizationId={org.id}
          showIntake={false}
          renderAction={(place) => (
            <span className="inline-flex items-center gap-2">
              <Link
                href={withOrg(placeHref(place.id), org.id)}
                className={PILL_BUTTON_CLASS}
              >
                Open
              </Link>
              <PlaceHoldButton
                action="claim"
                placeId={place.id}
                organizationId={org.id}
                allowed={canClaim(org.myRole)}
              />
            </span>
          )}
        />
      )}
    </>
  );
}
