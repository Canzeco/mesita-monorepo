// Account / Place — the client half.
//
//   Account        the signed-in manager
//   My Places      what this manager is a member of (`place_members`)
//   Public Places  the pool: places nobody holds, claimable by anyone
//   Place          one address, from either list
//
// THE PLACE IS THE ONLY TENANT NOW (MESITA-1892). There was a legal person
// above it — an organization that held places, held the Stripe account, held
// the partnership and held the members — and every one of those facts moved
// down onto `places` itself: `partnered`, `legal_name`, `rfc`,
// `stripe_billing_customer_id`, `place_payment_accounts`, `place_members`. So
// this module lists PLACES, and a place carries what its holder used to.
//
// ONE LIST, ONE ENDPOINT. `business-web-list-organizations` is deleted; the
// console's list is `business-web-list-places`, which is the list it always
// was — the scope decides whether it answers what you hold, the open pool, or
// both. The shell's envelope (`isSuperAdmin`, the Membership's catalog price)
// rides the member scopes, because those are the two console-wide facts the
// organizations payload used to carry and nothing else reads them.
//
// Every call is a business-web EF, so an ordinary business account works
// here — nothing on this path needs super-admin.
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentAccountState } from "@/lib/model/types";
import { invokeEF } from "./_invoke";

/** `place_members.role`. The same three tiers the organization had, on the
 *  thing they were always really about. */
export type PlaceRole = "owner" | "editor" | "viewer";

// THERE IS NO `RailPlace` HERE ANY MORE (MESITA-1892). It was the three
// fields the rail drew of a place the ORGANIZATION held, and it existed
// because the organization payload could not afford to ship the whole row. The
// portfolio IS `ConsolePlace[]` now, so the rail narrows it itself
// (`lib/rail-scope.ts`) and one name means one shape.

/** The place's live Mesita Membership — the yearly subscription that makes it
 *  a Partner (MESITA-1877; place-scoped since MESITA-1892). BILLING, never
 *  entitlement: `partnered` is the fact, this is why.
 *
 *  `state` is "active" or "past_due". Past due is STILL A PARTNER — Stripe is
 *  dunning a card that may well recover, and nothing about the partnership
 *  changes until the subscription actually ends. The console says the payment
 *  is due; it never says the partnership is gone. */
export type Membership = {
  state: "active" | "past_due";
  /** End of the paid period — when it renews, or when it lapses if it is
   *  cancelling. Null when Stripe has not set one yet. */
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
};

/** The catalog price of the Membership, off `membership_plans` — the same row
 *  the Stripe price is provisioned from, so what the owner reads is what
 *  Stripe bills. Null when the payload predates MESITA-1877 or the read
 *  failed. */
export type MembershipPrice = { priceCents: number; currency: string };

export type ConsolePlace = {
  id: string;
  name: string;
  address: string | null;
  zone: string | null;
  claimedAt: string | null;
  /** ONE url — the EF narrows places.photos to its first entry. Render it
   *  through placeThumbUrl(); it is a full-resolution original.
   *
   *  Everything below this line is OPTIONAL for the same reason
   *  ConsolePlaceDetail's photos are: merging to main auto-deploys every EF
   *  and triggers the Vercel build in parallel, so there is a window where a
   *  browser runs the new row against the old EF. Optional plus a default at
   *  the read site turns that window into a row with no chips for a minute,
   *  instead of a server component throwing mid-render. */
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
  /** THE CALLER HOLDS THIS PLACE — a `place_members` row of their own
   *  (MESITA-1892). It used to mean "an organization holds it"; the layer is
   *  gone, so the fact is now about the reader, which is what the Owned
   *  column was ever used to decide: Release here, Claim there. */
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
  /** Visit Rewards is ON — i.e. the place's strategy is not `zero`
   *  (MESITA-1882). The ONE commercial fact with no column behind it: the
   *  four rate columns spell a strategy, and the EF derives this boolean
   *  through the same `strategyForRates` that decides whether the guest app
   *  shows a Partner badge. Undefined on the pool, withheld with `partner`
   *  and `verified` — what a place gives away is not a stranger's business. */
  visitRewards?: boolean;

  // ── HELD ONLY ───────────────────────────────────────────────────────────
  //
  // What the organization row used to carry, on the place that carries it
  // now. Undefined on a pool row, and withheld for the same reason `partner`
  // and `verified` are: `getAuthedUser` accepts any bearer token and the
  // backend is a singleton, so scope=public is reachable by every consumer
  // account. A stranger does not learn a venue's RFC or what it pays.

  /** The caller's own role on this place. */
  myRole?: PlaceRole;
  /** The legal person behind the venue (`places.legal_name`, `places.rfc`).
   *  Owner-writable, and required before the place can be paid. */
  legalName?: string | null;
  rfc?: string | null;
  currency?: string;
  /** `places.partnered` — the Mesita Partner entitlement (MESITA-1892; it was
   *  `organizations.partnered`). UNDEFINED when the payload predates the EF —
   *  absent is not false. */
  partnered?: boolean;
  /** `place_profiles.mesita_pay_enabled` — THE Mesita Pay bit. The org half
   *  was folded into it (MESITA-1892), so there is one switch again. */
  mesitaPayEnabled?: boolean;
  /** The BILLING behind `partnered` (MESITA-1877) — the live Mesita
   *  Membership, or null.
   *
   *  NULL IS NOT "NOT A PARTNER". `partnered` is the entitlement and answers
   *  that on its own; this is null whenever the place became a partner some
   *  other way (the operator switch, a migration), and also whenever the
   *  billing read failed. Every consumer of it must degrade to the plain
   *  yearly line rather than concluding anything about the partnership. */
  membership?: Membership | null;
};

/** Everything the console shell learns about the caller in ONE call: the
 *  places they hold (each with its role, its partnership and its photo) and
 *  whether they are a super-admin, which decides whether the Admin view
 *  exists for them. */
export type ConsoleViewer = {
  places: ConsolePlace[];
  isSuperAdmin: boolean;
  /** One price for the whole console — it is a catalog fact, not a place's,
   *  so it rides the envelope rather than every row. */
  membershipPrice: MembershipPrice | null;
};

/** Which places `business-web-list-places` answers with.
 *
 *  `mine` is the portfolio — the places the caller holds a `place_members`
 *  row on. `public` is the open pool, reachable by any bearer token and
 *  therefore missing every held-only fact. `all` is both halves in one page,
 *  which is the comparison the catalogue exists to protect (MESITA-1614):
 *  Owned is a STATE, and a list pre-filtered on it can never show it vary. */
export type PlacesScope = "mine" | "all" | "public";

/** REQUEST-CACHED (MESITA-1729). The shell layout lists places for the rail,
 *  and then the place pages, the catalogue and account/page.tsx each list
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
  const { places, isSuperAdmin, membershipPrice } = await invokeEF<ConsoleViewer>(
    client,
    "business-web-list-places",
    { scope: "mine" },
    "Couldn't load your places.",
  );
  return {
    places: (places ?? []).map((p) => ({ ...p, membership: p.membership ?? null })),
    isSuperAdmin: isSuperAdmin === true,
    membershipPrice: membershipPrice ?? null,
  };
});

/** The portfolio alone — what every page body asks for. Reads through the
 *  request-cached viewer, so the shell's call and a page's call in the same
 *  render are still ONE Edge Function round trip (MESITA-1779). */
export const apiMyPlaces = cache(async function apiMyPlaces(
  client: SupabaseClient,
): Promise<ConsolePlace[]> {
  return (await apiConsoleViewer(client)).places;
});

/** The catalogue's read: any scope, optionally searched.
 *
 *  `all` is what the catalogue uses (MESITA-1614): the places you hold PLUS
 *  the claimable ones, so Owned can vary down the column. It and `mine` are
 *  the only scopes that ship every fact for every row — the pool scope
 *  withholds Partner, Verified, the intake map and everything under HELD ONLY
 *  above, because any Mesita account can reach it. */
export async function apiListConsolePlaces(
  client: SupabaseClient,
  args: { scope: PlacesScope; query?: string },
): Promise<ConsolePlace[]> {
  const { places } = await invokeEF<{ places: ConsolePlace[] }>(
    client,
    "business-web-list-places",
    args,
    "Couldn't load places.",
  );
  return places ?? [];
}

/** The legal person behind the venue — `places.legal_name` and `places.rfc`.
 *
 *  `name` IS NOT IN THE ANSWER (MESITA-1892), and the type must not claim it
 *  is. The endpoint echoed the ORGANIZATION's editable `name` back, because
 *  the legal person and the thing you could rename were one row. They are
 *  not: a place's `name` is a generated column on `place_profiles`
 *  (mesita_name → google_name), so this endpoint cannot write it and does not
 *  select it. Leaving `"name"` in the Pick typed a field the server never
 *  sends as a `string`, which no gate here can catch — the EF is on the other
 *  side of the wire — and the first caller to read `.name` off the result
 *  would get `undefined` with the compiler insisting otherwise. */
export async function apiUpdateLegalIdentity(
  client: SupabaseClient,
  input: { placeId: string; legalName: string | null; rfc: string | null },
): Promise<Pick<ConsolePlace, "id" | "legalName" | "rfc" | "currency">> {
  const { place } = await invokeEF<{
    place: Pick<ConsolePlace, "id" | "legalName" | "rfc" | "currency">;
  }>(
    client,
    "business-web-update-legal-identity",
    input,
    "Couldn't save the legal details.",
  );
  return place;
}

/** The place's Stripe Connect mirror row (`place_payment_accounts`). The
 *  merchant of record was the organization (MESITA-1545) and is the place
 *  itself now (MESITA-1892). Snake case — this is the EF's row shape. */
export type PaymentAccount = {
  place_id: string;
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
 * Which `disabled_reason` values mean the account is FINISHED, not unfinished.
 *
 * Stripe sets `requirements.disabled_reason` on a brand-new connected account
 * the moment capabilities are requested and their requirements are unmet — so
 * an Express account that has never collected a single field already carries
 * `requirements.past_due`. Everything else being equal, "disabled" and "not
 * started" are the same account on day zero, and only one of those two words
 * describes a next step the owner can take.
 *
 * `rejected.*` and `platform_paused` are the exception: Stripe (or Mesita)
 * closed the account, and reopening hosted onboarding on a closed account is a
 * loop, not a next step — the same reason `in_review` deliberately has no
 * button (MESITA-1645). Those keep winning over everything.
 */
function isTerminalDisabledReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return reason.startsWith("rejected.") || reason === "platform_paused";
}

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
 * ORDER IS THE BUG THIS FIXES (MESITA-1865). `disabled_reason` used to be read
 * before `details_submitted`, so EVERY account that walked away from hosted
 * onboarding came back reading **Restricted** — the state with no Resume
 * button — over `requirements.past_due`, which Stripe sets on day zero. An
 * owner who closed the Stripe tab had no way back in, and the only control on
 * the card was a dashboard that cannot exist yet. Submission now outranks a
 * non-terminal reason; a terminal one still outranks everything.
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
  if (orphaned || isTerminalDisabledReason(account.disabled_reason)) {
    return "restricted";
  }
  if (account.charges_enabled && account.payouts_enabled) return "live";
  if (account.charges_enabled) return "charges_only";
  if (!account.details_submitted || account.requirements_due.length > 0) {
    return "unfinished";
  }
  if (account.disabled_reason) return "restricted";
  return "in_review";
}

/**
 * Can the owner still be sent into Stripe's hosted onboarding?
 *
 * Read by the card instead of pattern-matching the pill. The pill answers
 * "where is this account"; this answers "is there a door", and they are not
 * the same question — an account can be Restricted for a reason hosted
 * onboarding collects (`requirements.past_due`) or for one it never will
 * (`rejected.fraud`).
 */
export function canResumeOnboarding(
  account: PaymentAccount | null,
  orphaned: boolean,
): boolean {
  if (!account || orphaned) return false;
  if (isTerminalDisabledReason(account.disabled_reason)) return false;
  return !account.details_submitted || account.requirements_due.length > 0;
}

/**
 * Can the Express Dashboard be opened at all?
 *
 * `accounts.createLoginLink` FAILS on an account that has not completed hosted
 * onboarding — there is no dashboard to log into yet — and the EF reported
 * that refusal as a Mesita misconfiguration, in rose, to a restaurant owner
 * whose actual problem was an unfinished form (MESITA-1865). A button that
 * cannot work is not offered.
 */
export function canOpenDashboard(
  account: PaymentAccount | null,
  orphaned: boolean,
): boolean {
  return account !== null && !orphaned && account.details_submitted;
}

/**
 * May this account be thrown away and replaced?
 *
 * Country is PER-ACCOUNT PERMANENT at Stripe, and legal entity decides which
 * documents the hosted flow asks for — both are answered before onboarding
 * opens, by someone who has never seen the flow. Getting either wrong used to
 * be terminal for the place: `classifyExistingAccount` answers
 * `use_country_mismatch`, which hands back a link to the same wrongly-countried
 * account forever.
 *
 * The window is narrow ON PURPOSE (`decision:` MESITA-1865): only while the
 * account has never submitted details and never charged. After that it may hold
 * KYC or money, and deleting it is an operator's call, not an inference a card
 * may make. The server re-checks this against Stripe's own object, never this
 * mirror — this predicate only decides whether to OFFER it.
 */
export function canRestartOnboarding(
  account: PaymentAccount | null,
  orphaned: boolean,
): boolean {
  if (!account || orphaned) return false;
  // A closed account is never quietly replaced with a fresh one. Stripe
  // rejected the ENTITY, not the paperwork, and minting another account for
  // the same place reads as working around that decision — it routes to a
  // person, like every other `rejected.*` surface (MESITA-1645).
  if (isTerminalDisabledReason(account.disabled_reason)) return false;
  return !account.details_submitted && !account.charges_enabled;
}

export async function apiGetPaymentAccount(
  client: SupabaseClient,
  placeId: string,
): Promise<{ account: PaymentAccount | null; orphaned: boolean }> {
  const { account, orphaned } = await invokeEF<{
    account: PaymentAccount | null;
    orphaned: boolean;
  }>(
    client,
    "business-web-get-payment-account",
    { placeId },
    "Couldn't load the payment account.",
  );
  return { account: account ?? null, orphaned: orphaned === true };
}

export async function apiStartPaymentOnboarding(
  client: SupabaseClient,
  input: {
    placeId: string;
    country: string;
    entityType?: string;
    /** Absolute, both of them. The EF refuses a relative path by name —
     *  Stripe Account Links reject one (MESITA-1643). */
    returnUrl: string;
    refreshUrl: string;
    /** Throw the existing account away and mint a fresh one under the country
     *  and legal entity in THIS request (MESITA-1865). The EF re-checks the
     *  live Stripe object before it deletes anything; this flag is a request,
     *  never a permission. */
    restart?: boolean;
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
  placeId: string,
): Promise<string | null> {
  const { url } = await invokeEF<{ url: string | null }>(
    client,
    "business-web-get-payment-dashboard-link",
    { placeId },
    "Couldn't open the payments dashboard.",
  );
  return url ?? null;
}

/** Opens Stripe Checkout for the place's yearly Mesita Membership
 *  (MESITA-1877). Owner-only, enforced by the EF.
 *
 *  It returns a URL in EVERY mode: real Stripe gives the hosted Checkout page,
 *  and MOCK_SUBSCRIPTION gives `successUrl` back after entitling inline — so
 *  the caller redirects, full stop, and never branches on `mock`.
 *
 *  `alreadyMember` is the one non-redirect answer: the place has a live
 *  membership, so there is nothing to sell. It exists because two tabs and a
 *  double-click are ordinary, and charging twice for one year is not. */
export async function apiStartMembership(
  client: SupabaseClient,
  input: { placeId: string; successUrl?: string; cancelUrl?: string },
): Promise<{ checkoutUrl: string | null; alreadyMember: boolean }> {
  const res = await invokeEF<{
    checkout_url?: string | null;
    already_member?: boolean;
  }>(
    client,
    "business-web-start-membership",
    input,
    "Couldn't start the membership checkout.",
  );
  return {
    checkoutUrl: res.checkout_url ?? null,
    alreadyMember: res.already_member === true,
  };
}

/** The `partnered` bit, and nothing else (MESITA-1892).
 *
 *  DELIBERATELY NOT `business-web-set-partnership`, which is a different door:
 *  that one sets the place's PLAN and rate strategy (join / drop / strategy).
 *  This one writes `places.partnered`, the entitlement the Membership buys.
 *  Two money doors one letter apart is how the wrong one gets edited, so the
 *  names are a word apart instead.
 *
 *  It no longer answers `mesitaPayEnabled`: `_shared/place-rails.ts` is the
 *  single writer of `place_profiles.mesita_pay_enabled`, and an endpoint that
 *  reports a bit it does not write is a second source of truth waiting. */
export async function apiSetPartnerStatus(
  client: SupabaseClient,
  placeId: string,
  partnered: boolean,
): Promise<{ partnered: boolean; joined: boolean; dropped: boolean }> {
  return invokeEF(
    client,
    "business-web-set-partner-status",
    { placeId, partnered },
    "Couldn't update Partner.",
  );
}

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

/** Who holds this place, and how. Null when the place is in the public pool —
 *  nobody holds it, so there is no role to report. It used to name the
 *  organization; with the layer gone (MESITA-1892) what is left is the
 *  caller's own membership and when the claim landed. */
export type PlaceHolder = {
  claimedAt: string | null;
  myRole: PlaceRole;
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

/** Claim a place out of the public pool. It mints the caller's own owner row
 *  (`claim_place(p_place_id, p_claimer)`), so there is no holder to name any
 *  more — you claim it for yourself. */
export async function apiClaimPlace(
  client: SupabaseClient,
  args: { placeId: string },
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
