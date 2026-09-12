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
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentAccountState } from "@/lib/model/types";
import { invokeEF } from "./_invoke";

export type OrgRole = "owner" | "editor" | "viewer";

/** A held place as the rail draws it: id, name, and the first photo
 *  (MESITA-1779). `photoUrl` is a FULL-RESOLUTION ORIGINAL — the rail renders
 *  it through `placeThumbUrl()`, never straight into an <img> (the
 *  MESITA-1553 mistake, and the rail is on every screen in the console). */
export type RailPlace = { id: string; name: string; photoUrl: string | null };

export type Organization = {
  id: string;
  name: string;
  legalName: string | null;
  rfc: string | null;
  currency: string;
  myRole: OrgRole;
  placeCount: number;
  /** The places this organization holds, by name. Rides the org list so the
   *  rail has its portfolio on the first frame instead of one round trip
   *  later (MESITA-1779). */
  places: RailPlace[];
};

/** Everything the console shell learns about the caller in ONE call: the
 *  organizations they belong to (each with its places) and whether they are a
 *  super-admin, which decides whether the Admin view exists for them. */
export type ConsoleViewer = {
  organizations: Organization[];
  isSuperAdmin: boolean;
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
  /** Created — google_place_id present, the identity spine. */
  seeded?: boolean;
  /** An organization holds this place. Constant per list scope today; the
   *  states matrix renders it anyway so both screens share one column set. */
  owned?: boolean;
  /** plan !== "free". UNDEFINED on the pool, where it is withheld — what an
   *  unheld place pays is not a guest's business. Undefined renders "?". */
  partner?: boolean;
  /** An approved place_verifications row. UNDEFINED both when withheld (the
   *  pool) and when the lookup FAILED — either way we did not read it, and a
   *  false here would state something we never learned. */
  verified?: boolean;
  /** The per-function map (MESITA-1687, reversing MESITA-1637's "the intake
   *  states are internal"). Pato, 2026-09-08: ship it to every business
   *  browser again — the console's own collapse toggle, default hidden, is
   *  what keeps it out of sight, not a server-side withhold. `enriching` and
   *  `enriched` above stay independent of this map; they read straight off
   *  the row, same as before. Local shape rather than an import from
   *  state-enrichment.ts — same no-shared-type convention as
   *  place-manage/actions.ts's own inline copy, so the two apps' payload
   *  types can drift on shape without a cross-file edit forcing them apart. */
  enrichFunctions?: Record<string, {
    state: "pending" | "completed" | "failed";
    at: string | null;
    detail: string | null;
  }>;
  orders?: boolean;
  pickupOrders?: boolean;
  deliveryOrders?: boolean;
  reservations?: boolean;
  mesitaPay?: boolean;
  credits?: boolean;
};

/** REQUEST-CACHED (MESITA-1729). The shell layout lists organizations for the
 *  rail's switcher, and then organization/page.tsx, places/page.tsx,
 *  account/page.tsx and the pool branch of places/[id]/layout.tsx each list
 *  them again for their own body — a second full Edge Function round trip in
 *  the same render. invokeEF is a supabase-js POST, so Next's fetch dedupe
 *  never saw it. cache() is the same idiom lib/place-view.ts already uses for
 *  the two place loaders.
 *
 *  Keyed on `client`, which is now itself request-cached in lib/supabase/server,
 *  so every caller in one request presents the same instance and shares the
 *  entry. */
export const apiConsoleViewer = cache(async function apiConsoleViewer(
  client: SupabaseClient,
): Promise<ConsoleViewer> {
  const { organizations, isSuperAdmin } = await invokeEF<ConsoleViewer>(
    client,
    "business-web-list-organizations",
    {},
    "Couldn't load your organizations.",
  );
  return {
    organizations: (organizations ?? []).map((o) => ({
      ...o,
      places: o.places ?? [],
    })),
    isSuperAdmin: isSuperAdmin === true,
  };
});

/** The organizations alone — what every page body asks for. Reads through
 *  the request-cached viewer, so the shell's call and a page's call in the
 *  same render are still ONE Edge Function round trip (MESITA-1779). */
export const apiListOrganizations = cache(async function apiListOrganizations(
  client: SupabaseClient,
): Promise<Organization[]> {
  return (await apiConsoleViewer(client)).organizations;
});

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

/** One pending email invite (MESITA-1550) — mirrors PendingEditorInvite. */
export type PendingOrgInvite = {
  id: string;
  email: string;
  role: OrgRole;
  createdAt: string;
  expiresAt: string;
};

export async function apiListOrgMembers(
  client: SupabaseClient,
  orgId: string,
): Promise<{ members: OrgMember[]; pendingInvites: PendingOrgInvite[] }> {
  const { members, pendingInvites } = await invokeEF<{
    members: OrgMember[];
    pendingInvites: PendingOrgInvite[];
  }>(
    client,
    "business-web-list-org-members",
    { orgId },
    "Couldn't load members.",
  );
  return { members: members ?? [], pendingInvites: pendingInvites ?? [] };
}

type AddOrgMemberResult =
  | { mode: "linked"; member: OrgMember }
  | {
      mode: "invited";
      inviteId: string;
      token: string;
      expiresAt: string;
      email: string;
      role: OrgRole;
      emailSent: boolean;
      emailError: string | null;
    };

export async function apiAddOrgMember(
  client: SupabaseClient,
  input: { orgId: string; email: string; role: OrgRole; redirectBase?: string },
): Promise<AddOrgMemberResult> {
  return await invokeEF<AddOrgMemberResult>(
    client,
    "business-web-add-org-member",
    input,
    "Couldn't add that member.",
  );
}

export async function apiRemoveOrgMember(
  client: SupabaseClient,
  input: { orgId: string; id: string; kind: "member" | "invite" },
): Promise<{ id: string; kind: "member" | "invite" }> {
  return await invokeEF<{ id: string; kind: "member" | "invite" }>(
    client,
    "business-web-remove-org-member",
    input,
    "Couldn't remove that member.",
  );
}

export async function apiUpdateOrgMemberRole(
  client: SupabaseClient,
  input: { orgId: string; memberId: string; role: OrgRole },
): Promise<{ memberId: string; role: OrgRole }> {
  return await invokeEF<{ memberId: string; role: OrgRole }>(
    client,
    "business-web-update-org-member-role",
    input,
    "Couldn't update that member's role.",
  );
}

export async function apiAcceptOrgInvite(
  client: SupabaseClient,
  token: string,
): Promise<{ organizationId: string; role: OrgRole }> {
  return await invokeEF<{ organizationId: string; role: OrgRole }>(
    client,
    "business-web-accept-org-invite",
    { token },
    "Couldn't accept the invite.",
  );
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

/**
 * One derivation, shared by the badge and the pill — never re-derived.
 *
 * Charge capability is read FIRST because it is the strongest fact Stripe
 * gives us. Below it, the split that matters (MESITA-1645): an owner with
 * outstanding requirements — whether they never finished or Stripe came back
 * asking — has work to do and gets Resume. An owner with nothing outstanding
 * and still no charges is waiting on Stripe, and Resume would only reopen a
 * form they already completed.
 *
 * KNOWN LIMIT, stated rather than papered over: a permanently restricted
 * account that submitted everything and has nothing due is indistinguishable
 * from one under review, because the mirror carries no submitted-at timestamp.
 * Both read "Stripe is checking", which is true of one and merely quiet about
 * the other. Telling them apart needs a timestamp we do not store yet.
 */
export function paymentAccountState(
  account: PaymentAccount | null,
  orphaned: boolean,
): PaymentAccountState {
  if (!account) return "none";
  if (orphaned || account.disabled_reason) return "restricted";
  if (account.charges_enabled && account.payouts_enabled) return "live";
  if (account.charges_enabled) return "charges_only";
  if (!account.details_submitted || account.requirements_due.length > 0) {
    return "unfinished";
  }
  return "in_review";
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
  input: {
    orgId: string;
    country: string;
    entityType?: string;
    /** Absolute, both of them. The EF refuses a relative path by name —
     *  Stripe Account Links reject one (MESITA-1643). */
    returnUrl: string;
    refreshUrl: string;
  },
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

/** scope "all" and "org" both need organizationId and are membership reads;
 *  "public" is the open pool.
 *
 *  "all" is what the console list uses (MESITA-1614): this organization's
 *  places PLUS the claimable ones, so Owned can vary down the column. It is
 *  also the only scope that ships every fact for every row — the pool scope
 *  withholds Partner, Verified and the intake map because any Mesita account
 *  can reach it, and "all" is behind requireOrgRole. */
export async function apiListConsolePlaces(
  client: SupabaseClient,
  args: {
    scope: "all" | "org" | "public";
    organizationId?: string;
    query?: string;
  },
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
  /** Raw `places.state`. `listed` is the fact the console gates on; this
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
   *  place_members row — the old-style owned place (MESITA-1537 E-E1). */
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
