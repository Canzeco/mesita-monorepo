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
import type { PaymentAccountState } from "@/lib/model/types";
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
  /** The holder's NAME. Null in the public pool — a pooled place is held by
   *  nobody, and the row says so rather than inventing a holder.
   *
   *  Everything below this line is OPTIONAL for the same reason
   *  ConsolePlaceDetail's photos are: merging to main auto-deploys every EF
   *  and triggers the Vercel build in parallel, so there is a window where a
   *  browser runs the new row against the old EF. Optional plus a default at
   *  the read site turns that window into a row with no chips for a minute,
   *  instead of a server component throwing mid-render. */
  organizationName?: string | null;
  /** ONE url — the EF narrows places.photos to its first entry. Render it
   *  through placeThumbUrl(); it is a full-resolution original. */
  photoUrl?: string | null;
  listed?: boolean;
  /** Requested is a COUNT, never Yes/No (MESITA-1372). */
  requestCount?: number;
  requested?: boolean;
  enriching?: boolean;
  enriched?: boolean;
  /** Google's OPERATIONAL fact. Null is silence, not "not operational" —
   *  which is why it is a string and not a boolean. */
  businessState?: string | null;
  /** Intake meter: 0 is the CREATED floor, intakeTotal is a finished run. */
  intakePulse?: number;
  intakeTotal?: number;
  orders?: boolean;
  pickupOrders?: boolean;
  deliveryOrders?: boolean;
  reservations?: boolean;
  mesitaPay?: boolean;
  credits?: boolean;
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

/** One row of the Members box. `name` is null until the person fills their
 *  profile — production has zero names today, so email is the primary line. */
export type OrgMember = {
  managerId: string;
  name: string | null;
  email: string | null;
  role: OrgRole;
};

export async function apiListOrgMembers(
  client: SupabaseClient,
  orgId: string,
): Promise<OrgMember[]> {
  const { members } = await invokeEF<{ members: OrgMember[] }>(
    client,
    "business-web-list-org-members",
    { orgId },
    "Couldn't load members.",
  );
  return members ?? [];
}

export async function apiAddOrgMember(
  client: SupabaseClient,
  input: { orgId: string; email: string; role: "editor" | "viewer" },
): Promise<OrgMember> {
  const { member } = await invokeEF<{ member: OrgMember }>(
    client,
    "business-web-add-org-member",
    input,
    "Couldn't add that member.",
  );
  return member;
}

/** The organization's Stripe Connect mirror row (MESITA-1545: the merchant
 *  of record is the organization). Snake case — this is the EF's row shape. */
export type PaymentAccount = {
  organization_id: string;
  stripe_account_id: string;
  livemode: boolean;
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  requirements_due: string[];
  disabled_reason: string | null;
  country: string | null;
};

/** One derivation, shared by the badge and the pill — never re-derived. */
export function paymentAccountState(
  account: PaymentAccount | null,
  orphaned: boolean,
): PaymentAccountState {
  if (!account) return "none";
  if (orphaned || account.disabled_reason) return "restricted";
  if (!account.details_submitted) return "pending";
  if (account.charges_enabled && account.payouts_enabled) return "live";
  if (account.charges_enabled) return "charges_only";
  return "pending";
}

export async function apiGetPaymentAccount(
  client: SupabaseClient,
  orgId: string,
): Promise<{ account: PaymentAccount | null; orphaned: boolean }> {
  const { account, orphaned } = await invokeEF<{
    account: PaymentAccount | null;
    orphaned: boolean;
  }>(
    client,
    "business-web-get-payment-account",
    { orgId },
    "Couldn't load the payment account.",
  );
  return { account: account ?? null, orphaned: orphaned === true };
}

export async function apiStartPaymentOnboarding(
  client: SupabaseClient,
  input: { orgId: string; country: string },
): Promise<{ url: string | null; mock: boolean }> {
  const { url, mock } = await invokeEF<{ url: string | null; mock: boolean }>(
    client,
    "business-web-start-payment-onboarding",
    input,
    "Couldn't start payment onboarding.",
  );
  return { url: url ?? null, mock: mock === true };
}

export async function apiGetPaymentDashboardLink(
  client: SupabaseClient,
  orgId: string,
): Promise<string | null> {
  const { url } = await invokeEF<{ url: string | null }>(
    client,
    "business-web-get-payment-dashboard-link",
    { orgId },
    "Couldn't open the payments dashboard.",
  );
  return url ?? null;
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
  /** Photos, ratings and the true photo count are OPTIONAL on purpose.
   *
   *  Merging to main auto-deploys every EF and triggers the Vercel build in
   *  parallel, so there is a window where a browser runs the new page against
   *  the old EF. If these were required, `photos.length` would throw inside a
   *  server component and the whole screen would 500 — the page's try/catch
   *  wraps the fetch, not the render. Optional plus a default at the read site
   *  turns that window into a place with no photos for a minute. */
  photos?: string[] | null;
  /** The real count before the wire cap, so the caption can say "10 of 13". */
  totalPhotos?: number | null;
  googleStars?: number | null;
  googleReviewCount?: number | null;
};

export type ConsolePlaceView = {
  place: ConsolePlaceDetail;
  holder: PlaceHolder | null;
  claimable: boolean;
  /** Set when the place is in no organization but the caller holds a direct
   *  project_members row — the old-style owned place (MESITA-1537 E-E1). */
  myDirectRole?: string | null;
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
