// Places — ONE list (MESITA-1614). What this organization holds and what it
// can claim, in one page, told apart by the Owned column.
//
// It used to be two screens. That split was a filter wearing the costume of a
// screen: both listed places, both rendered the same row, and the only
// difference between them was whether `organization_id` was yours or null —
// which is Owned, a STATE. Pre-filtering it meant the states matrix could
// never show it varying, so the column read the same on every row of both
// halves. One list says the same thing and lets you compare.
//
// The row's action follows the fact rather than the screen: Release where you
// hold it, Claim where you do not. Both were already role-gated
// (`canRelease` / `canClaim`), and `PlaceHoldButton` renders nothing when the
// role does not allow it, so a viewer sees a list and no verbs.
import { Store } from "lucide-react";
import Link from "next/link";
import { Search } from "lucide-react";
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
import {
  canClaim,
  canRelease,
  resolveActiveOrg,
} from "@/lib/active-organization";
import { SHELL_ROUTES, placeHref, withOrg } from "@/lib/console-routes";
import {
  CTA_BUTTON_CLASS,
  INPUT_CLASS,
  PILL_BUTTON_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlacesPage({
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
  if (!user) redirect("/signin?next=/places");

  const orgs = await apiListOrganizations(supabase).catch(() => []);
  const org = resolveActiveOrg(orgs, sp.org);
  if (!org) {
    return (
      <>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Places
        </h1>
        <NoOrganization />
      </>
    );
  }

  let places: ConsolePlace[] = [];
  let error: string | null = null;
  try {
    // scope "all" is a MEMBERSHIP read — held by this org, or held by nobody.
    // It is also the only scope that ships every fact for every row: the pool
    // scope withholds Partner, Verified and the intake map because any Mesita
    // account can reach it, and this one is behind requireOrgRole.
    places = await apiListConsolePlaces(supabase, {
      scope: "all",
      organizationId: org.id,
      query,
    });
  } catch (e) {
    error = errMsg(e, "Couldn't load places.");
  }

  const held = places.filter((p) => p.owned === true).length;

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Places
        </h1>
        <p className="text-muted-foreground text-[13px]">
          {held} held by {org.name} · the rest are claimable
        </p>
      </div>

      <form action={SHELL_ROUTES.places} className="relative">
        <input type="hidden" name="org" value={org.id} />
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name..."
          aria-label="Search places"
          className={cn(INPUT_CLASS, "pl-9")}
        />
      </form>

      {error ? (
        <PageErrorState
          heading="Couldn't load places"
          message={error}
          retryHref={withOrg(SHELL_ROUTES.places, org.id)}
        />
      ) : places.length === 0 ? (
        /* TWO empty states, not three — the screens merged, so "the pool is
           empty" and "you hold none" collapsed into one honest sentence. The
           zero-catalogue case is production today (0 places, 0 organizations),
           so it is the state everyone actually sees, and it gets the action. */
        <EmptyState
          icon={<Store className="text-muted-foreground h-5 w-5" />}
          title={query ? "No places match that" : "No places yet"}
          description={
            query
              ? "Try a different name, or clear the search."
              : "The catalogue has no places yet. Add one and it lands here, yours to claim."
          }
          action={
            query ? (
              <Link
                href={withOrg(SHELL_ROUTES.places, org.id)}
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
        <PlaceStatesTable
          places={places}
          organizationId={org.id}
          showIntake
          renderAction={(place) => (
            <span className="inline-flex items-center gap-2">
              <Link
                href={withOrg(placeHref(place.id), org.id)}
                className={PILL_BUTTON_CLASS}
              >
                Open
              </Link>
              {/* The action follows the FACT, not the screen. */}
              <PlaceHoldButton
                action={place.owned ? "release" : "claim"}
                placeId={place.id}
                organizationId={org.id}
                allowed={
                  place.owned ? canRelease(org.myRole) : canClaim(org.myRole)
                }
              />
            </span>
          )}
        />
      )}
    </>
  );
}
