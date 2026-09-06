// Account / Organization / Place — the client half.
//
//   Account       the signed-in manager
//   Organization  the legal person; one account may be in many
//   Org Places    what an organization holds
//   Public Places the pool: places in no organization, claimable by any
//   Place         one address, from either list
//
// Every call is a business-web EF, so an ordinary business account works
// here — nothing on this path needs super-admin.
import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type OrgRole = "owner" | "editor" | "viewer";

export type Organization = {
  id: string;
  name: string;
  legalName: string | null;
  rfc: string | null;
  currency: string;
  myRole: OrgRole;
  placeCount: number;
};

export type ConsolePlace = {
  id: string;
  name: string;
  address: string | null;
  zone: string | null;
  organizationId: string | null;
  claimedAt: string | null;
};

export async function apiListOrganizations(
  client: SupabaseClient,
): Promise<Organization[]> {
  const { organizations } = await invokeEF<{ organizations: Organization[] }>(
    client,
    "business-web-list-organizations",
    {},
    "Couldn't load your organizations.",
  );
  return organizations ?? [];
}

export async function apiCreateOrganization(
  client: SupabaseClient,
  input: { name: string; legalName?: string | null; rfc?: string | null },
): Promise<Organization> {
  const { organization } = await invokeEF<{ organization: Organization }>(
    client,
    "business-web-create-organization",
    input,
    "Couldn't create that organization.",
  );
  return organization;
}

export async function apiUpdateOrganization(
  client: SupabaseClient,
  input: { orgId: string; legalName: string | null; rfc: string | null },
): Promise<Pick<Organization, "id" | "name" | "legalName" | "rfc" | "currency">> {
  const { organization } = await invokeEF<{
    organization: Pick<
      Organization,
      "id" | "name" | "legalName" | "rfc" | "currency"
    >;
  }>(
    client,
    "business-web-update-organization",
    input,
    "Couldn't save the legal details.",
  );
  return organization;
}

/** scope "org" needs organizationId; scope "public" is the pool. */
export async function apiListConsolePlaces(
  client: SupabaseClient,
  args: { scope: "org" | "public"; organizationId?: string; query?: string },
): Promise<ConsolePlace[]> {
  const { places } = await invokeEF<{ places: ConsolePlace[] }>(
    client,
    "business-web-list-places",
    args,
    "Couldn't load places.",
  );
  return places ?? [];
}

/** One place, plus who holds it. The holder is null when the place is in
 *  the public pool — nobody holds it, so there is no role to report. */
export type PlaceHolder = {
  organizationId: string;
  organizationName: string;
  claimedAt: string | null;
  myRole: OrgRole;
};

/** The Place screen's payload. `listed` / `enriched` / `verified` arrive
 *  DERIVED from the EF rather than computed here: the same three facts are
 *  read by admin surfaces off the same helpers, and a state that disagrees
 *  with itself across two screens is worse than no state at all. */
export type ConsolePlaceDetail = {
  id: string;
  name: string;
  address: string | null;
  zone: string | null;
  city: string | null;
  category: string | null;
  categoryLabel: string | null;
  phone: string | null;
  timezone: string | null;
  currency: string;
  /** Raw `projects.state`. `listed` is the fact the console gates on; this
   *  is the reason behind a false one, and the screen shows it only then. */
  state: string;
  contentState: string;
  enrichedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  listed: boolean;
  enriched: boolean;
  verified: boolean;
};

export type ConsolePlaceView = {
  place: ConsolePlaceDetail;
  holder: PlaceHolder | null;
  claimable: boolean;
};

export async function apiGetConsolePlace(
  client: SupabaseClient,
  placeId: string,
): Promise<ConsolePlaceView> {
  return invokeEF<ConsolePlaceView>(
    client,
    "business-web-get-place",
    { placeId },
    "Couldn't load that place.",
  );
}

export async function apiClaimPlace(
  client: SupabaseClient,
  args: { placeId: string; organizationId: string },
): Promise<void> {
  await invokeEF(
    client,
    "business-web-claim-place",
    args,
    "Couldn't claim that place.",
  );
}

export async function apiReleasePlace(
  client: SupabaseClient,
  args: { placeId: string },
): Promise<void> {
  await invokeEF(
    client,
    "business-web-release-place",
    args,
    "Couldn't release that place.",
  );
}
