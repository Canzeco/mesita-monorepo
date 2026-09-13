// Places — ONE list (MESITA-1614), under its organization (MESITA-1807).
// What this organization holds and what it can claim, in one page, told
// apart by the Owned column.
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
import { EmptyState } from "@/components/shared/EmptyState";
import { PageErrorState } from "@/components/business/PageErrorState";
import { PlaceHoldButton } from "@/components/console/PlaceHoldButton";
import { PlaceVerifyButton } from "@/components/console/PlaceVerifyButton";
import { PlaceStatesTable } from "@/components/console/PlaceStatesTable";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiListConsolePlaces,
  type ConsolePlace,
} from "@/lib/api/organizations";
import {
  canAddPlace,
  canClaim,
  canRelease,
  canVerify,
} from "@/lib/active-organization";
import {
  ownedFromParam,
  orgPlacesHref,
  orgPlacesNewHref,
  placeHref,
} from "@/lib/console-routes";
import { requireOrg } from "@/lib/org-scope";
import { CTA_BUTTON_CLASS, GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrganizationPlacesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgId }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createServerSupabase();
  const org = await requireOrg(supabase, orgId);

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
  const canAdd = canAddPlace(org.myRole);

  // ONE READ, then a view of it (MESITA-1710). `?owned=org` and `?owned=public`
  // are saved filters on this page, not screens, and the filter runs HERE
  // rather than in the EF: `scope: "all"` already returns both halves in one
  // call with every fact attached, so a per-filter fetch would be a second
  // round trip for rows we are already holding. MESITA-1614 stands.
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
          Places
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
                href={orgPlacesHref(org.id)}
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
          retryHref={orgPlacesHref(org.id)}
        />
      ) : visible.length === 0 ? (
        /* TWO empty states. An empty catalogue outranks the filter: keying
           off `owned` first would answer "Nothing left to claim" on
           `?owned=public` when the catalogue holds nothing at all. Ask "is
           there anything?" before "did I hide it?". Owner gets Add place
           (MESITA-1813). A viewer gets an honest empty, no CTA. A filter
           that empties a non-empty catalogue still hands back the other
           half, plus Add place for the owner. */
        <EmptyState
          icon={<Store className="text-muted-foreground h-5 w-5" />}
          title={
            places.length === 0
              ? canAdd
                ? "No places yet"
                : "This organization has no places."
              : owned === "org"
                ? `${org.name} holds none yet`
                : "Nothing left to claim"
          }
          description={
            places.length === 0
              ? canAdd
                ? "Search for the place. If Mesita has it, add it to this organization. If not, create it."
                : undefined
              : owned === "org"
                ? "Claim one from Public Places and it lands here."
                : "Every place in the catalogue is already held."
          }
          action={
            places.length === 0 ? (
              canAdd ? (
                <Link
                  href={orgPlacesNewHref(org.id)}
                  className={CTA_BUTTON_CLASS}
                >
                  Add place
                </Link>
              ) : null
            ) : (
              <span className="flex flex-wrap items-center justify-center gap-2">
                {canAdd && (
                  <Link
                    href={orgPlacesNewHref(org.id)}
                    className={CTA_BUTTON_CLASS}
                  >
                    Add place
                  </Link>
                )}
                {owned === "org" ? (
                  <Link
                    href={orgPlacesHref(org.id, "public")}
                    className={
                      canAdd ? GHOST_PILL_BUTTON_CLASS : CTA_BUTTON_CLASS
                    }
                  >
                    See Public Places
                  </Link>
                ) : owned === "public" ? (
                  <Link
                    href={orgPlacesHref(org.id, "org")}
                    className={
                      canAdd ? GHOST_PILL_BUTTON_CLASS : CTA_BUTTON_CLASS
                    }
                  >
                    See Org Places
                  </Link>
                ) : null}
              </span>
            )
          }
        />
      ) : (
        <PlaceStatesTable
          places={visible}
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
                  href={placeHref(place.id)}
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
