// Claim a place — the ceremony (MESITA-1800). The collection is never
// a create form: businesses do not mint places (MESITA-1664). This page
// is the catalogue's unclaimed half, with Claim on the row.
import { Store } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageErrorState } from "@/components/business/PageErrorState";
import { PlaceHoldButton } from "@/components/console/PlaceHoldButton";
import { PlaceStatesTable } from "@/components/console/PlaceStatesTable";
import { NoOrganization } from "@/components/console/NoOrganization";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";
import {
  apiListConsolePlaces,
  apiListOrganizations,
  type ConsolePlace,
} from "@/lib/api/organizations";
import { canClaim, resolveActiveOrg } from "@/lib/active-organization";
import { SHELL_ROUTES, placeHref, withOrg } from "@/lib/console-routes";
import { CTA_BUTTON_CLASS, GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewPlacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  const user = await getServerUser();
  if (!user) redirect("/signin?next=/places/new");

  let orgs: Awaited<ReturnType<typeof apiListOrganizations>> = [];
  let orgsError = false;
  try {
    orgs = await apiListOrganizations(supabase);
  } catch (e) {
    orgsError = true;
    console.error("[places/new] business-web-list-organizations:", e);
  }
  const org = resolveActiveOrg(orgs, sp.org);
  if (orgsError || !org) {
    return (
      <>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Claim a place
        </h1>
        {orgsError ? (
          <PageErrorState
            heading="Couldn't load your organizations"
            message="The console could not read which organizations you belong to. Reload to try again."
            retryHref={SHELL_ROUTES.placesNew}
          />
        ) : (
          <NoOrganization />
        )}
      </>
    );
  }

  const cancelHref = withOrg(SHELL_ROUTES.places, org.id);

  let places: ConsolePlace[] = [];
  let error: string | null = null;
  try {
    places = await apiListConsolePlaces(supabase, {
      scope: "all",
      organizationId: org.id,
    });
  } catch (e) {
    error = errMsg(e, "Couldn't load places.");
  }

  const claimable = places.filter((p) => p.owned !== true);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Claim a place
      </h1>
      <p className="text-muted-foreground -mt-2 text-sm">
        Mesita already listed it. Claim it into {org.name} and you can verify
        ownership from there.
      </p>

      {error ? (
        <PageErrorState
          heading="Couldn't load places"
          message={error}
          retryHref={withOrg(SHELL_ROUTES.placesNew, org.id)}
        />
      ) : claimable.length === 0 ? (
        <EmptyState
          icon={<Store className="text-muted-foreground h-5 w-5" />}
          title={
            places.length === 0 ? "No places yet" : "Nothing left to claim"
          }
          description={
            places.length === 0
              ? "Mesita adds places to the catalogue. As soon as yours is listed it lands here, ready to claim."
              : "Every place in the catalogue is already held."
          }
          action={
            places.length === 0 ? null : (
              <Link href={cancelHref} className={CTA_BUTTON_CLASS}>
                See Places
              </Link>
            )
          }
        />
      ) : (
        <PlaceStatesTable
          places={claimable}
          organizationId={org.id}
          actionsByPlaceId={Object.fromEntries(
            claimable.map((place) => [
              place.id,
              <span key={place.id} className="inline-flex items-center gap-2">
                <Link
                  href={withOrg(placeHref(place.id), org.id)}
                  className={GHOST_PILL_BUTTON_CLASS}
                >
                  Open
                </Link>
                <PlaceHoldButton
                  action="claim"
                  placeId={place.id}
                  organizationId={org.id}
                  allowed={canClaim(org.myRole)}
                />
              </span>,
            ]),
          )}
        />
      )}

      <Link
        href={cancelHref}
        className={`${GHOST_PILL_BUTTON_CLASS} self-start`}
      >
        Cancel
      </Link>
    </>
  );
}
