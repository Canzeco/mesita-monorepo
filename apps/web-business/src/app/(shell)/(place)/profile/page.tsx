// Profile — the Place screen's landing tab.
//
// Two shapes, one route. A place the caller can MANAGE renders admin's
// Single Place profile editor verbatim. A place still in the POOL has no
// manage surface yet, so this is where Claim lives (the tab row hides
// everything else until it is held).
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { DataRow } from "@/components/console/badges";
import { PlaceGallery } from "@/components/console/PlaceGallery";
import { PlaceHoldButton } from "@/components/console/PlaceHoldButton";
import { createServerSupabase } from "@/lib/supabase/server";
import { getManagePlace, getPlaceView } from "@/lib/place-view";
import { getSelection } from "@/lib/selected-place";
import { apiListOrganizations } from "@/lib/api/organizations";
import { canClaim, canRelease, preferredOrg } from "@/lib/active-organization";
import { SHELL_ROUTES, orgPlacesHref } from "@/lib/console-routes";
import { RAIL_ORG_COOKIE, plausibleId } from "@/lib/sidebar-prefs";
import { ProfileTab } from "./ProfileTab";

export const dynamic = "force-dynamic";

export default async function PlaceProfilePage() {
  const { placeId } = await getSelection();
  // The layout above answered the no-place case; a null here is unreachable.
  const id = placeId as string;
  const manage = await getManagePlace(id);
  if (manage) return <ProfileTab />;

  // ── Pool place: identity + the claim door. ──────────────────────────────
  const supabase = await createServerSupabase();
  const view = await getPlaceView(supabase, id);
  const orgs = await apiListOrganizations(supabase).catch(() => []);
  // Claim writes into an organization, and a pool place names none: the one
  // remembered from the last visit (the rail's own cookie), else the first —
  // the same fallback the rail shows beside this page.
  const jar = await cookies();
  const activeOrg = preferredOrg(
    orgs,
    plausibleId(jar.get(RAIL_ORG_COOKIE)?.value),
  );
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
