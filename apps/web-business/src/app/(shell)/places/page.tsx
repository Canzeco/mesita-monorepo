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
import { PlaceVerifyButton } from "@/components/console/PlaceVerifyButton";
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
  canVerify,
  resolveActiveOrg,
} from "@/lib/active-organization";
import {
  SHELL_ROUTES,
  ownedFromParam,
  placeHref,
  placesHref,
  withOrg,
} from "@/lib/console-routes";
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

  // ONE READ, then a view of it (MESITA-1710). The rail's `Org Places` and
  // `Public Places` rows are saved filters on this page, not screens, and the
  // filter runs HERE rather than in the EF: `scope: "all"` already returns both
  // halves in one call with every fact attached, so a per-filter fetch would be
  // a second round trip for rows we are holding. MESITA-1614 stands — the split
  // is still a filter, it just has a name in the rail now.
  const owned = ownedFromParam(sp.owned);
  const visible = owned
    ? places.filter((p) => (owned === "org" ? p.owned === true : p.owned !== true))
    : places;

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {owned === "org"
            ? "Org Places"
            : owned === "public"
              ? "Public Places"
              : "Places"}
        </h1>
        <p className="text-muted-foreground text-[13px]">
          {owned === "org" ? (
            <>
              {held} held by {org.name}
            </>
          ) : owned === "public" ? (
            <>{places.length - held} claimable, held by nobody</>
          ) : (
            <>
              {held} held by {org.name} · the rest are claimable
            </>
          )}
          {owned && (
            <>
              {" · "}
              <Link
                href={withOrg(placesHref(), org.id)}
                className="hover:text-foreground underline underline-offset-2"
              >
                see all {places.length}
              </Link>
            </>
          )}
        </p>
      </div>

      <form action={SHELL_ROUTES.places} className="relative">
        <input type="hidden" name="org" value={org.id} />
        {/* The filter survives a search. Without this the form drops ?owned=
            and a search from Org Places silently lands you on the full list. */}
        {owned && <input type="hidden" name="owned" value={owned} />}
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
      ) : visible.length === 0 ? (
        /* THREE empty states. Two are the merge's (MESITA-1664, MESITA-1614):
           the search found nothing, or the catalogue itself is empty — the
           zero-catalogue case is production today (0 places, 0 organizations),
           so it is the state everyone actually sees, and it gets no action
           because businesses do not put places into the catalogue any more,
           Mesita does.

           The third arrived with the rail's filters (MESITA-1710) and it is
           the one that would have lied: on `?owned=org` with places in the
           pool, "No places yet" is false — there ARE places, just none of them
           yours. A filter that empties the screen has to say it was the filter,
           and hand back the way out. */
        <EmptyState
          icon={<Store className="text-muted-foreground h-5 w-5" />}
          title={
            query
              ? "No places match that"
              : owned === "org"
                ? `${org.name} holds none yet`
                : owned === "public"
                  ? "Nothing left to claim"
                  : "No places yet"
          }
          description={
            query
              ? "Try a different name, or clear the search."
              : owned === "org"
                ? "Claim one from Public Places and it lands here."
                : owned === "public"
                  ? "Every place in the catalogue is already held."
                  : "Mesita adds places to the catalogue. As soon as yours is listed it lands here, ready to claim."
          }
          action={
            query ? (
              <Link
                href={withOrg(placesHref(owned), org.id)}
                className={CTA_BUTTON_CLASS}
              >
                Clear the search
              </Link>
            ) : owned === "org" && places.length > held ? (
              <Link
                href={withOrg(placesHref("public"), org.id)}
                className={CTA_BUTTON_CLASS}
              >
                See Public Places
              </Link>
            ) : owned ? (
              <Link
                href={withOrg(placesHref(), org.id)}
                className={CTA_BUTTON_CLASS}
              >
                See all places
              </Link>
            ) : null
          }
        />
      ) : (
        <PlaceStatesTable
          places={visible}
          organizationId={org.id}
          // PlaceStatesTable is a Client Component (the intake toggle needs
          // state), so the action cell has to arrive pre-rendered — a
          // function cannot cross the server/client boundary, but this
          // already-built JSX can. Rendered here, once per place, exactly as
          // the old renderAction callback did.
          actionsByPlaceId={Object.fromEntries(
            visible.map((place) => [
              place.id,
              <span key={place.id} className="inline-flex items-center gap-2">
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
                {/* Verify is offered on exactly the rows it can act on: held,
                    and not yet proven. Owned and Verified are independent
                    facts (a place can be verified without being enriched, and
                    held without being verified), so this reads both rather
                    than assuming an order. `verified` is optional on the row
                    for the usual deploy-window reason, so an undefined one
                    shows no control instead of a wrong one. */}
                {place.owned === true && place.verified !== true && (
                  <PlaceVerifyButton
                    placeId={place.id}
                    allowed={canVerify(org.myRole)}
                  />
                )}
              </span>,
            ]),
          )}
        />
      )}
    </>
  );
}
