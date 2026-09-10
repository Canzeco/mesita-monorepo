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
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageErrorState } from "@/components/business/PageErrorState";
import { PlaceHoldButton } from "@/components/console/PlaceHoldButton";
import { PlaceVerifyButton } from "@/components/console/PlaceVerifyButton";
import { PlaceStatesTable } from "@/components/console/PlaceStatesTable";
import { NoOrganization } from "@/components/console/NoOrganization";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
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
import { CTA_BUTTON_CLASS, GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const supabase = await createServerSupabase();
  // getServerUser, not supabase.auth.getUser: the shell layout above already
  // validated this JWT over the network this request, and cache() hands back
  // that answer instead of asking again (MESITA-1729).
  const user = await getServerUser();
  if (!user) redirect("/signin?next=/places");

  // An organizations fetch failure is an ERROR, not "None yet" — the same law
  // account/page.tsx states and obeys. Collapsing the two sends an operator who
  // already HAS an organization to "Create an organization", and creating a
  // second one is not undoable from this console.
  let orgs: Awaited<ReturnType<typeof apiListOrganizations>> = [];
  let orgsError = false;
  try {
    orgs = await apiListOrganizations(supabase);
  } catch (e) {
    orgsError = true;
    console.error("[places] business-web-list-organizations:", e);
  }
  const org = resolveActiveOrg(orgs, sp.org);
  if (orgsError || !org) {
    return (
      <>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Places
        </h1>
        {orgsError ? (
          <PageErrorState
            heading="Couldn't load your organizations"
            message="The console could not read which organizations you belong to. Reload to try again."
            retryHref={SHELL_ROUTES.places}
          />
        ) : (
          <NoOrganization />
        )}
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
    //
    // No search: this screen loads every place the org can see and hands
    // sorting to PlaceStatesTable, client-side (Pato, 2026-09-09) — a filter
    // that trims the row COUNT belongs on the server, but ordering the rows
    // the browser already has does not need a round trip.
    places = await apiListConsolePlaces(supabase, {
      scope: "all",
      organizationId: org.id,
    });
  } catch (e) {
    error = errMsg(e, "Couldn't load places.");
  }

  const held = places.filter((p) => p.owned === true).length;

  // ONE READ, then a view of it (MESITA-1710). The rail's `Org Places` and
  // `Public Places` rows are saved filters on this page, not screens, and the
  // filter runs HERE rather than in the EF: `scope: "all"` already returns both
  // halves in one call with every fact attached, so a per-filter fetch would be
  // a second round trip for rows we are already holding. MESITA-1614 stands —
  // the split is still a filter, it just has a name in the rail now.
  //
  // Same argument MESITA-1711 made about sorting: work on rows the page
  // already has does not need a round trip.
  const owned = ownedFromParam(sp.owned);
  const visible = owned
    ? places.filter((p) =>
        owned === "org" ? p.owned === true : p.owned !== true,
      )
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

      {error ? (
        <PageErrorState
          heading="Couldn't load places"
          message={error}
          retryHref={withOrg(SHELL_ROUTES.places, org.id)}
        />
      ) : visible.length === 0 ? (
        /* TWO empty states. The first is the merge's (MESITA-1664): the
           catalogue itself is empty — production today (0 places, 0
           organizations), so it is the state everyone actually sees, and it
           gets no action, because businesses do not put places into the
           catalogue any more, Mesita does. Offering "Add a place" would be a
           button leading nowhere a manager is allowed to go.

           The second arrived with the rail's filters (MESITA-1710), and it is
           the one that would have lied: on `?owned=org` with places sitting in
           the pool, "No places yet" is false — there ARE places, just none of
           them yours. A filter that empties the screen has to say it was the
           filter, and hand back the way out. */
        <EmptyState
          icon={<Store className="text-muted-foreground h-5 w-5" />}
          title={
            // AN EMPTY CATALOGUE OUTRANKS THE FILTER, and this is the case
            // that is live right now (0 places, 0 organizations). Keying off
            // `owned` first would answer "Nothing left to claim — every place
            // in the catalogue is already held" on `?owned=public` when the
            // catalogue holds nothing at all: a filter explaining an absence
            // it did not cause. Ask "is there anything?" before "did I hide
            // it?".
            places.length === 0
              ? "No places yet"
              : owned === "org"
                ? `${org.name} holds none yet`
                : "Nothing left to claim"
          }
          description={
            places.length === 0
              ? "Mesita adds places to the catalogue. As soon as yours is listed it lands here, ready to claim."
              : owned === "org"
                ? "Claim one from Public Places and it lands here."
                : "Every place in the catalogue is already held."
          }
          action={
            // No action on an empty catalogue: there is nowhere to send anyone
            // (MESITA-1664 — businesses do not add places, Mesita does).
            places.length === 0 ? null : owned === "org" ? (
              <Link
                href={withOrg(placesHref("public"), org.id)}
                className={CTA_BUTTON_CLASS}
              >
                See Public Places
              </Link>
            ) : owned === "public" ? (
              <Link
                href={withOrg(placesHref("org"), org.id)}
                className={CTA_BUTTON_CLASS}
              >
                See Org Places
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
                {/* Open is navigation, not a mutation — it stays a quiet
                    ghost pill so the one dark fill in the row is the action
                    that actually changes the place's state (Claim), not the
                    one that just reads it. */}
                <Link
                  href={withOrg(placeHref(place.id), org.id)}
                  className={GHOST_PILL_BUTTON_CLASS}
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
