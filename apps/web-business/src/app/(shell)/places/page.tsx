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
import { SHELL_ROUTES, withOrg, placeHref } from "@/lib/console-routes";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

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

      {error ? (
        <PageErrorState
          heading="Couldn't load places"
          message={error}
          retryHref={withOrg(SHELL_ROUTES.places, org.id)}
        />
      ) : places.length === 0 ? (
        /* ONE empty state — the screens merged, so "the pool is empty" and
           "you hold none" collapsed into one honest sentence. The
           zero-catalogue case is production today (0 places, 0 organizations),
           so it is the state everyone actually sees.

           It gets no action (MESITA-1664). Businesses do not put places into
           the catalogue any more; Mesita does. Offering "Add a place" here
           would be a button that leads nowhere a manager is allowed to go,
           and the empty state's job in that world is to say who to wait for,
           not to invent a verb. */
        <EmptyState
          icon={<Store className="text-muted-foreground h-5 w-5" />}
          title="No places yet"
          description="Mesita adds places to the catalogue. As soon as yours is listed it lands here, ready to claim."
        />
      ) : (
        <PlaceStatesTable
          places={places}
          organizationId={org.id}
          // PlaceStatesTable is a Client Component (the intake toggle needs
          // state), so the action cell has to arrive pre-rendered — a
          // function cannot cross the server/client boundary, but this
          // already-built JSX can. Rendered here, once per place, exactly as
          // the old renderAction callback did.
          actionsByPlaceId={Object.fromEntries(
            places.map((place) => [
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
