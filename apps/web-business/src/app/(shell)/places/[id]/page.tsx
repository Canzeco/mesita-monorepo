// Place — the fifth screen. One address: what it is, where it stands, and
// who holds it.
//
// It reads business-web-get-place, NOT business-web-get-overview. Overview
// resolves a non-super-admin's places from `project_members`, and an
// org-claimed place has no such row, so the old per-place console could
// never load one — that is the defect this screen closes (MESITA-1548).
//
// Reachable from BOTH lists. A pool place renders the same facts and
// offers Claim instead of Release; nothing here is hidden behind holding
// it, because the pool listing already shows the world these places exist.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Section } from "@/components/shared/Section";
import { DataRow, PlaceStateBadge } from "@/components/console/badges";
import { PlaceHoldButton } from "@/components/console/PlaceHoldButton";
import { PageErrorState } from "@/components/business/PageErrorState";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiGetConsolePlace,
  apiListOrganizations,
  type ConsolePlaceView,
} from "@/lib/api/organizations";
import {
  canClaim,
  canRelease,
  resolveActiveOrg,
} from "@/lib/active-organization";
import { SHELL_ROUTES, placeHref, withOrg } from "@/lib/console-routes";
import { errMsg, formatDay, formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** `projects.state` reads as a database label; this is the operator's
 *  version of the same fact. Only shown when the place is NOT listed —
 *  when it is, "Listed · Yes" already said everything. */
const UNLISTED_REASON: Record<string, string> = {
  paused: "Paused",
  archived: "Archived",
  pending_review: "Waiting on review",
  pending_verification: "Waiting on verification",
};

/** Where the Intaker got to. Enriched is the fact; the two mid-flight
 *  content states are the honest "not yet". */
function profileLabel(place: ConsolePlaceView["place"]): string {
  if (place.enriched) return "Enriched";
  if (place.contentState === "generating" || place.contentState === "queued") {
    return "Enriching";
  }
  if (place.contentState === "failed") return "Enrichment failed";
  return "Not enriched";
}

export default async function PlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(placeHref(id))}`);

  const orgs = await apiListOrganizations(supabase).catch(() => []);
  const activeOrg = resolveActiveOrg(orgs, sp.org);

  let view: ConsolePlaceView;
  try {
    view = await apiGetConsolePlace(supabase, id);
  } catch (e) {
    const message = errMsg(e, "Couldn't load that place.");
    // The EF answers 404 both for a place that does not exist and for one
    // held by an organization you are not in — deliberately the same
    // answer, so this branch must not try to tell them apart either.
    if (/not found/i.test(message)) notFound();
    return (
      <PageErrorState
        heading="Couldn't load this place"
        message={message}
        retryHref={withOrg(placeHref(id), activeOrg?.id ?? null)}
      />
    );
  }

  const { place, holder, claimable } = view;

  // Back to wherever this place lives: the portfolio when you hold it, the
  // pool when nobody does.
  const backHref = holder
    ? withOrg(SHELL_ROUTES.places, holder.organizationId)
    : withOrg(SHELL_ROUTES.pool, activeOrg?.id ?? null);
  const backLabel = holder ? "Org Places" : "Public Places";

  const subtitle = [
    place.categoryLabel ?? place.category,
    place.zone ?? place.city,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-[13px]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {place.name}
          </h1>
          {/* The ladder is Listed → Verified. A place that is neither gets
              no badge rather than a false one; the State section says what
              it is instead. */}
          {place.verified ? (
            <PlaceStateBadge state="verified" />
          ) : place.listed ? (
            <PlaceStateBadge state="listed" />
          ) : null}
        </div>
        {subtitle && (
          <p className="text-muted-foreground -mt-2 text-[13px]">{subtitle}</p>
        )}
      </div>

      <Section title="Identity" description="What this address is.">
        <div>
          <DataRow label="Address">{place.address ?? "Not set"}</DataRow>
          <DataRow label="Zone">{place.zone ?? "Not set"}</DataRow>
          <DataRow label="City">{place.city ?? "Not set"}</DataRow>
          <DataRow label="Phone">{place.phone ?? "Not set"}</DataRow>
          <DataRow label="Timezone">{place.timezone ?? "Not set"}</DataRow>
          <DataRow label="Currency">{place.currency}</DataRow>
        </div>
      </Section>

      <Section
        title="State"
        description="Listed means a guest can reach it. Verified means someone proved they run it."
      >
        <div>
          <DataRow label="Listed">
            {place.listed ? "Yes" : (UNLISTED_REASON[place.state] ?? "No")}
          </DataRow>
          <DataRow label="Verified">{place.verified ? "Yes" : "No"}</DataRow>
          <DataRow label="Profile">{profileLabel(place)}</DataRow>
        </div>
      </Section>

      <Section
        title="Holding"
        description={
          holder
            ? "An organization holds this place. Releasing returns it to the public pool."
            : "Nobody holds this place. Claiming moves it into your organization."
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
            {holder ? (
              <Link
                href={withOrg(SHELL_ROUTES.organization, holder.organizationId)}
                className="hover:underline"
              >
                {holder.organizationName}
              </Link>
            ) : (
              "The public pool"
            )}
          </DataRow>
          {holder && (
            <>
              <DataRow label="Claimed">
                {holder.claimedAt ? formatDay(holder.claimedAt) : "Unknown"}
              </DataRow>
              <DataRow label="Your role">
                <span className="capitalize">{holder.myRole}</span>
              </DataRow>
            </>
          )}
          {!holder && !activeOrg && (
            <DataRow label="Claim it">Create an organization first</DataRow>
          )}
        </div>
      </Section>

      <p className="text-muted-foreground text-[12px]">
        {place.createdAt && `Added ${formatDay(place.createdAt)}`}
        {place.createdAt && place.updatedAt && " · "}
        {place.updatedAt && `updated ${formatRelative(place.updatedAt)}`}
      </p>
    </>
  );
}
