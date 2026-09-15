// Places — ONE list (MESITA-1614), at the top of the console (MESITA-1892).
// What you hold and what you can claim, in one page, told apart by the Owned
// column.
//
// It used to be two screens. That split was a filter wearing the costume of a
// screen: both listed places, both rendered the same row, and the only
// difference between them was whether `organization_id` was yours or null —
// which is Owned, a STATE. Pre-filtering it meant the states matrix could
// never show it varying, so the column read the same on every row of both
// halves. One list says the same thing and lets you compare.
//
// OWNED IS ABOUT YOU NOW, not about a holder above you. The organization is
// gone and `place_members` is the only claim on a place, so the column asks
// "do I hold this?" — which is what it was ever used to decide: Release here,
// Claim there.
//
// AND THE LIST LEFT ITS PARENT WITH IT. It hung under `/orgs/<id>/places`,
// which was the one address where an organization listed both the places it
// held and the places nobody did. There is no organization to hang it under,
// and scoping it beneath one place would be asking a venue to list its
// siblings — so it is `/places`, above them all, and `/places/new` is the
// ceremony beside it. Both addresses were PERMANENT redirect sources until
// this issue; freeing them is the MESITA-1839 trap in reverse, and
// `legacy-redirects.test.ts` is what proves the rules are really gone.
//
// The row's action follows the fact rather than the screen: Release where you
// hold it, Claim where you do not. Release is owner-only (`canRelease`) and
// `PlaceHoldButton` renders nothing when the role does not allow it, so an
// editor sees a list and one verb. Claim is no longer role-gated at all:
// `claim_place(p_place_id, p_claimer)` mints the claimer's own owner row, so
// there is no membership to hold before you hold the place.
import { Store } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageErrorState } from "@/components/business/PageErrorState";
import { PlaceHoldButton } from "@/components/console/PlaceHoldButton";
import { PlaceVerifyButton } from "@/components/console/PlaceVerifyButton";
import { PlaceStatesTable } from "@/components/console/PlaceStatesTable";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import { apiListConsolePlaces, type ConsolePlace } from "@/lib/api/console";
import { canRelease, canVerify } from "@/lib/active-place";
import {
  SHELL_ROUTES,
  ownedFromParam,
  placeHref,
  placesHref,
} from "@/lib/console-routes";
import { CTA_BUTTON_CLASS, GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlacesCatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await getServerUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(SHELL_ROUTES.places)}`);
  const supabase = await createServerSupabase();

  let places: ConsolePlace[] = [];
  let error: string | null = null;
  try {
    // scope "all" — held by me, or held by nobody. It is also the only scope
    // besides "mine" that ships every fact for every row: the pool scope
    // withholds Partner, Verified and the intake map because any Mesita
    // account can reach it.
    //
    // No search: this screen loads every place the caller can see and hands
    // sorting to PlaceStatesTable, client-side (Pato, 2026-09-09) — a filter
    // that trims the row COUNT belongs on the server, but ordering the rows
    // the browser already has does not need a round trip.
    places = await apiListConsolePlaces(supabase, { scope: "all" });
  } catch (e) {
    error = errMsg(e, "Couldn't load places.");
  }

  const held = places.filter((p) => p.owned === true).length;

  // ONE READ, then a view of it (MESITA-1710). `?owned=mine` and
  // `?owned=public` are saved filters on this page, not screens, and the
  // filter runs HERE rather than in the EF: `scope: "all"` already returns
  // both halves in one call with every fact attached, so a per-filter fetch
  // would be a second round trip for rows we are already holding.
  // MESITA-1614 stands.
  const owned = ownedFromParam(sp.owned);
  const visible = owned
    ? places.filter((p) =>
        owned === "mine" ? p.owned === true : p.owned !== true,
      )
    : places;

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Places
        </h1>
        <p className="text-muted-foreground text-[13px]">
          {owned === "mine" ? (
            <>{held} you hold</>
          ) : owned === "public" ? (
            <>{places.length - held} claimable, held by nobody</>
          ) : (
            <>
              {held} you hold · the rest are claimable
            </>
          )}
          {owned && (
            <>
              {" · "}
              <Link
                href={placesHref()}
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
          retryHref={placesHref()}
        />
      ) : visible.length === 0 ? (
        /* TWO empty states. An empty catalogue outranks the filter: keying
           off `owned` first would answer "Nothing left to claim" on
           `?owned=public` when the catalogue holds nothing at all. Ask "is
           there anything?" before "did I hide it?". Add place is offered in
           every one of them now (MESITA-1892) — the ceremony has no role gate
           left, because claiming mints your own owner row. A filter that
           empties a non-empty catalogue still hands back the other half. */
        <EmptyState
          icon={<Store className="text-muted-foreground h-5 w-5" />}
          title={
            places.length === 0
              ? "No places yet"
              : owned === "mine"
                ? "You hold none yet"
                : "Nothing left to claim"
          }
          description={
            places.length === 0
              ? "Search for your place. If Mesita already has it, claim it. If not, create it."
              : owned === "mine"
                ? "Claim one from Public Places and it lands here."
                : "Every place in the catalogue is already held."
          }
          action={
            places.length === 0 ? (
              <Link href={SHELL_ROUTES.placesNew} className={CTA_BUTTON_CLASS}>
                Add place
              </Link>
            ) : (
              <span className="flex flex-wrap items-center justify-center gap-2">
                <Link href={SHELL_ROUTES.placesNew} className={CTA_BUTTON_CLASS}>
                  Add place
                </Link>
                {owned === "mine" ? (
                  <Link
                    href={placesHref("public")}
                    className={GHOST_PILL_BUTTON_CLASS}
                  >
                    See Public Places
                  </Link>
                ) : owned === "public" ? (
                  <Link
                    href={placesHref("mine")}
                    className={GHOST_PILL_BUTTON_CLASS}
                  >
                    See your places
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
                  allowed={place.owned ? canRelease(place.myRole) : true}
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
                    allowed={canVerify(place.myRole)}
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
