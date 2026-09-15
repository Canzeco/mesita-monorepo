"use client";

// A POOL PLACE's Profile: identity, and the door that claims it
// (MESITA-1875, lifted out of `profile/page.tsx`).
//
// It reads EVERYTHING FROM CONTEXT and fetches nothing. Both facts were
// already resolved one layout up or one shell up:
//
//   the place      `PlaceScope.view` — the layout's own `getPlaceView`, the
//                  same read that produced the 404 verdict
//   the org        `RailScopeContext` — AppShell resolved the viewer's
//                  organizations and the remembered one for the rail
//                  (MESITA-1822), which is exactly what the old page
//                  recomputed with `apiListOrganizations` + `preferredOrg`
//                  over the rail's own cookie
//
// That is three Edge Function calls and a cookie read deleted from a screen
// whose entire job is to show four fields and one button.
//
// THE FALLBACKS ARE NOT DEAD CODE. `RailScopeContext` is null outside the
// shell, and the scope's org is null for a viewer who belongs to none — both
// land on "Create an organization first", which is the honest next step and
// the one the old page already rendered.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { DataRow } from "@/components/console/badges";
import { PlaceGallery } from "@/components/console/PlaceGallery";
import { PlaceHoldButton } from "@/components/console/PlaceHoldButton";
import { useRailScopeContext } from "@/components/console/RailScopeContext";
import { canClaim, canRelease } from "@/lib/active-organization";
import { SHELL_ROUTES, orgPlacesHref } from "@/lib/console-routes";
import { usePlaceScope } from "../PlaceScope";

export function PoolProfile() {
  const { view } = usePlaceScope();
  const rail = useRailScopeContext();
  // The rail's own answer to "which organization am I in" — cookie-remembered,
  // else the first. Recomputing it here is how the page and the column beside
  // it end up naming two different organizations.
  const activeOrg = rail?.scope.org ?? null;

  // The layout publishes `view` for exactly this branch; a held place renders
  // ProfileTab instead and never reaches here.
  if (!view) return null;
  const { place, holder, claimable } = view;

  // One list since MESITA-1614, so held and unheld places go back to the
  // same screen. A held place carries its holder's org so Back lands on the
  // portfolio you came from rather than on whichever org happened to be active.
  const backHref = holder
    ? orgPlacesHref(holder.organizationId)
    : activeOrg
      ? orgPlacesHref(activeOrg.id)
      : SHELL_ROUTES.root;

  return (
    <>
      <Link
        href={backHref}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-[13px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Places
      </Link>

      <PlaceGallery
        photos={place.photos ?? []}
        totalPhotos={place.totalPhotos ?? (place.photos ?? []).length}
        name={place.name}
      />

      <Section title="Identity" description="What this address is.">
        <div>
          <DataRow label="Address">{place.address ?? "Not set"}</DataRow>
          <DataRow label="Zone">{place.zone ?? "Not set"}</DataRow>
          <DataRow label="City">{place.city ?? "Not set"}</DataRow>
          <DataRow label="Phone">{place.phone ?? "Not set"}</DataRow>
        </div>
      </Section>

      <Section
        title="Holding"
        description={
          holder
            ? "An organization holds this place. Releasing returns it to the public pool."
            : "Nobody holds this place. Claiming moves it into your organization — and makes you its owner, which is what unlocks the staff PIN and Partnership."
        }
        right={
          holder ? (
            <PlaceHoldButton
              action="release"
              placeId={place.id}
              organizationId={holder.organizationId}
              allowed={canRelease(holder.myRole)}
            />
          ) : claimable && activeOrg ? (
            <PlaceHoldButton
              action="claim"
              placeId={place.id}
              organizationId={activeOrg.id}
              allowed={canClaim(activeOrg.myRole)}
            />
          ) : null
        }
      >
        <div>
          <DataRow label="Held by">
            {holder ? holder.organizationName : "The public pool"}
          </DataRow>
          {!holder && !activeOrg && (
            <DataRow label="Claim it">Create an organization first</DataRow>
          )}
        </div>
      </Section>
    </>
  );
}
