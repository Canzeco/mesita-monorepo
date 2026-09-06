// Profile — the Place screen's landing tab.
//
// Two shapes, one route. A place the caller can MANAGE renders admin's
// Single Place profile editor verbatim. A place still in the POOL has no
// manage surface yet, so this is where Claim lives (the tab row hides
// everything else until it is held).
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { DataRow } from "@/components/console/badges";
import { PlaceGallery } from "@/components/console/PlaceGallery";
import { PlaceHoldButton } from "@/components/console/PlaceHoldButton";
import { createServerSupabase } from "@/lib/supabase/server";
import { getManagePlace, getPlaceView } from "@/lib/place-view";
import { apiListOrganizations } from "@/lib/api/organizations";
import { canClaim, canRelease, resolveActiveOrg } from "@/lib/active-organization";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";
import { ProfileTab } from "./ProfileTab";

export const dynamic = "force-dynamic";

export default async function PlaceProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (manage) return <ProfileTab />;

  // ── Pool place: identity + the claim door. ──────────────────────────────
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  const view = await getPlaceView(supabase, id);
  const orgs = await apiListOrganizations(supabase).catch(() => []);
  const activeOrg = resolveActiveOrg(orgs, sp.org);
  const { place, holder, claimable } = view;

  const backHref = holder
    ? withOrg(SHELL_ROUTES.places, holder.organizationId)
    : withOrg(SHELL_ROUTES.pool, activeOrg?.id ?? null);

  return (
    <>
      <Link
        href={backHref}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-[13px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {holder ? "Org Places" : "Public Places"}
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
