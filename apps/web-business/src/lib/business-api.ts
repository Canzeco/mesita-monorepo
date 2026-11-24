"use server";

// The Business app's server actions over its own Edge Functions
// (MESITA-3103). Each returns the Result shape the screens branch on; the
// server decides who may see or change a place, never these wrappers.

import { efInvoke } from "@/lib/supabase-ef";
import { CASHBACK_DEFAULTS, type CashbackRates, readCashback } from "@/lib/cashback";
import type { RefillOrigin } from "@/lib/premier-origin";
import type { CustomerCursor, CustomersPage, MonitorCursor, MonitorFilter, MonitorKind, MonitorPage, PayoutsAnswer } from "@/lib/monitor";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string | null };

function fail(r: { error: string; code: string | null }): { ok: false; error: string; code: string | null } {
  return { ok: false, error: r.error, code: r.code };
}

// ── Identity ────────────────────────────────────────────────────────────

export type MyPlaceState = "owner" | "expired" | "pending" | "rejected";

export type MyPlace = {
  place_id: string;
  name: string | null;
  photo: string | null;
  state: MyPlaceState;
  /** owner | editor on a place you run (MESITA-3120); null for a request. */
  role: "owner" | "editor" | null;
  method: string | null;
  expires_at: string | null;
  decision_note: string | null;
};

export type Identity = {
  email: string | null;
  phone: string | null;
  isSuperAdmin: boolean;
  hasAccount: boolean;
  places: MyPlace[];
};

export async function getIdentity(): Promise<Result<Identity>> {
  const r = await efInvoke<Identity & { ok: true }>("business-web-get-identity", {});
  if (!r.ok) return fail(r);
  const { email, phone, isSuperAdmin, hasAccount, places } = r.data;
  return { ok: true, data: { email, phone, isSuperAdmin, hasAccount, places: places ?? [] } };
}

// ── Claim ───────────────────────────────────────────────────────────────

/** A search row (MESITA-3112): a Mesita place (`id`) or a Google listing
 *  Mesita doesn't hold yet (`google_place_id`, "Add and claim"). */
export type FoundPlace = {
  id: string | null;
  google_place_id: string | null;
  name: string | null;
  address: string | null;
  photo: string | null;
  masked_phone: string | null;
  phone_on_listing: boolean;
  mine: "owner" | "expired" | "pending" | null;
  /** Someone else holds the owner seat: their email, masked (`p•••@canzeco.com`, MESITA-3155). */
  claimed_by?: string | null;
};

/** A Mesita place, the only kind the claim form takes. */
export type ClaimablePlace = FoundPlace & { id: string };

export async function findPlaces(input: { q?: string; placeId?: string; sessionToken?: string }): Promise<Result<FoundPlace[]>> {
  const r = await efInvoke<{ places: FoundPlace[] }>("business-web-find-place", {
    q: input.q,
    place_id: input.placeId,
    sessionToken: input.sessionToken,
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data.places ?? [] };
}

/** Google's preview of a listing Mesita doesn't hold (MESITA-3138): read
 *  once when the Add dialog opens, never stored. `photoUrl` is Google's own
 *  short-lived link; `photoAuthor` is the credit Google requires. */
export type GooglePreview = {
  name: string;
  address: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
  photoUrl: string | null;
  photoAuthor: string | null;
  mapsUrl: string | null;
};

export async function previewGooglePlace(googlePlaceId: string): Promise<Result<GooglePreview>> {
  const r = await efInvoke<{ preview: GooglePreview }>("business-web-find-place", { preview_place_id: googlePlaceId });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data.preview };
}

/** Adds a Google listing to Mesita (get-or-create); the id to claim. */
export async function createPlace(googlePlaceId: string): Promise<Result<{ placeId: string; created: boolean; enriching: boolean }>> {
  const r = await efInvoke<{ created: boolean; enriching?: boolean; place: { id: string } }>("business-web-create-place", { googlePlaceId });
  if (!r.ok) return fail(r);
  // `enriching`: the add started Enrich (MESITA-3140).
  return { ok: true, data: { placeId: r.data.place.id, created: r.data.created === true, enriching: r.data.enriching === true } };
}

export type ClaimOutcome = "verified" | "pending" | "already_pending" | "already_owner" | "needs_details";

export async function requestVerification(input: {
  placeId: string;
  name?: string;
  role?: string;
  contact?: string;
  note?: string;
}): Promise<Result<ClaimOutcome>> {
  const r = await efInvoke<{ outcome: ClaimOutcome }>("business-web-request-verification", {
    place_id: input.placeId,
    name: input.name,
    role: input.role,
    contact: input.contact,
    note: input.note,
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data.outcome };
}

/** The claim call (MESITA-3127): a call to the place's listing phone says a 6-digit code. */
/** `test`: calls are off (MESITA-3148) and the code is 123456. */
export async function callPlaceCode(
  placeId: string,
): Promise<Result<{ outcome: "calling" | "already_owner"; maskedPhone: string | null; minutes: number; test: boolean }>> {
  const r = await efInvoke<{ outcome: "calling" | "already_owner"; masked_phone?: string | null; minutes?: number; test?: boolean }>(
    "business-web-call-place-code",
    { place_id: placeId },
  );
  if (!r.ok) return fail(r);
  return {
    ok: true,
    data: { outcome: r.data.outcome, maskedPhone: r.data.masked_phone ?? null, minutes: r.data.minutes ?? 10, test: r.data.test === true },
  };
}

/** The code the call said. `tries_left` comes back on a wrong code. */
export async function checkPlaceCode(placeId: string, code: string): Promise<Result<"verified">> {
  const r = await efInvoke<{ outcome: "verified" }>("business-web-check-place-code", { place_id: placeId, code });
  if (!r.ok) return fail(r);
  return { ok: true, data: "verified" };
}

export async function leavePlace(placeId: string): Promise<Result<null>> {
  const r = await efInvoke<{ ok: true }>("business-web-leave-place", { place_id: placeId });
  if (!r.ok) return fail(r);
  return { ok: true, data: null };
}

// ── Team (MESITA-3120: one owner, editors; per place, no org layer) ─────

export type TeamMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: "owner" | "editor";
  live: boolean;
  expires_at: string;
  me: boolean;
};

export type TeamInvite = { id: string; email: string; created_at: string };

export type Team = { role: "owner" | "editor" | "superadmin"; members: TeamMember[]; invites: TeamInvite[] };

export async function getTeam(placeId: string): Promise<Result<Team>> {
  const r = await efInvoke<Team & { ok: true }>("business-web-get-team", { place_id: placeId });
  if (!r.ok) return fail(r);
  return { ok: true, data: { role: r.data.role, members: r.data.members ?? [], invites: r.data.invites ?? [] } };
}

export async function inviteEditor(placeId: string, email: string): Promise<Result<TeamInvite>> {
  const r = await efInvoke<{ invite: TeamInvite }>("business-web-invite-editor", { place_id: placeId, email });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data.invite };
}

export async function removeMember(placeId: string, target: { managerId?: string; inviteId?: string }): Promise<Result<null>> {
  const r = await efInvoke<{ ok: true }>("business-web-remove-member", {
    place_id: placeId,
    manager_id: target.managerId,
    invite_id: target.inviteId,
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: null };
}

export async function transferOwner(placeId: string, managerId: string): Promise<Result<null>> {
  const r = await efInvoke<{ ok: true }>("business-web-transfer-owner", { place_id: placeId, manager_id: managerId });
  if (!r.ok) return fail(r);
  return { ok: true, data: null };
}

// ── Premier ─────────────────────────────────────────────────────────────

export type BoostTier = "boost_2x" | "boost_5x";
export type BoostInterval = "month" | "year";

export type PremierQuote = {
  price_cents: number;
  charge_cents: number;
  credit_cents: number;
  extra_days: number;
  new_ends_at: string | null;
  renews_at: string | null;
  kind: "buy" | "change" | "resume" | "blocked";
  blocked_by: "taken" | "charging" | null;
  checkout: "payment" | "setup" | "none";
  covered: boolean;
};

export type PlacePremier = {
  role: "owner" | "superadmin";
  tier: number;
  manual: { tier: number; ends_at: string; source?: string } | null;
  paid: { tier: number; ends_at: string; renews: boolean; by_you: boolean } | null;
  renewing: boolean;
  viewer: "payer" | "former_payer" | "stranger" | null;
  can_resume: boolean;
  mine: {
    id: string;
    tier: number;
    interval: BoostInterval;
    status: "open" | "ready";
    pending: number | null;
    has_card: boolean;
    checkout: string | null;
  } | null;
  /** Yearly only since MESITA-3285. */
  quotes: Record<BoostTier, { year: PremierQuote }> | null;
  outcome?: string;
  /** How often an ad slot showed this place, and how often a guest opened it (MESITA-4460). */
  ads?: { impressions: number; taps: number };
};

export async function getPremier(placeId: string, sessionId?: string | null): Promise<Result<PlacePremier>> {
  const r = await efInvoke<PlacePremier>("business-web-get-premier", {
    place_id: placeId,
    ...(sessionId ? { session_id: sessionId } : {}),
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data };
}

// ── Billing (MESITA-3128; what runs and what is charged next, MESITA-3166) ──

type Rank = 1 | 2;

export type PlaceBilling = {
  /** The place's time zone and today's date there; every date is drawn in it. */
  timezone: string;
  today: string;
  /** When the server made this view; the timeline starts here. */
  now: string;
  /** Who pays the place's Premier: you, someone else on the team, or nobody. */
  payer: "you" | "team" | null;
  /** The level now; `until` is null at 0 or while a subscription renews it;
   *  `days_left` only within 7 days. */
  level: { tier: 0 | Rank; until: string | null; days_left: number | null };
  /** Running and queued Refill days, in run order. */
  refill: Array<{ id: string; tier: Rank; origin: RefillOrigin; starts_at: string; ends_at: string; state: "running" | "next" }>;
  subscription: {
    tier: Rank;
    interval: BoostInterval;
    amount_cents: number;
    state: "running" | "paused" | "waiting" | "charging";
    next_charge_at: string | null;
    next_charge_cents: number;
    resumes_at: string | null;
    early_start: boolean;
  } | null;
  moved: { from: string; to: string; days: number; origin: RefillOrigin; granted_at: string } | null;
  keep: { tier: Rank; ends_at: string; price_cents: number } | null;
  /** YYYY-MM-DD in the place's time zone, per tier. */
  subscribe_from: Partial<Record<Rank, string>>;
  /** The payer's own card; only ever sent to the payer. */
  card: { brand: string; last4: string; exp_month: number; exp_year: number } | null;
  card_expires_before_charge: boolean;
  /** The caller's own saved cards at Stripe (MESITA-3185). */
  cards: Array<{ id: string; brand: string; last4: string; exp_month: number; exp_year: number; in_use: boolean }>;
  charges: Array<{
    id: string;
    at: string;
    tier: number;
    interval: BoostInterval;
    starts_at: string;
    ends_at: string;
    amount_cents: number;
    status: "paid" | "declined" | "charging";
    /** Stripe's receipt page; only for a charge the caller paid. */
    receipt_url?: string | null;
  }>;
};

export async function getBilling(placeId: string): Promise<Result<PlaceBilling>> {
  const r = await efInvoke<PlaceBilling & { ok: true }>("business-web-get-billing", { place_id: placeId });
  if (!r.ok) return fail(r);
  const data = r.data;
  // The EF before MESITA-3166 (live until its redeploy, ~5 min after the
  // app): no schedule to draw, so say so rather than draw half a page.
  if (!data.level || !data.timezone) return { ok: false, error: "Billing is updating. Try again in a few minutes." };
  return {
    ok: true,
    data: { ...data, refill: data.refill ?? [], subscribe_from: data.subscribe_from ?? {}, cards: data.cards ?? [], charges: data.charges ?? [] },
  };
}

// ── What you pay (MESITA-3130) ─────────────────────────────────────────

/** One Premier subscription the caller pays, on any place, run or not. */
export type MySubscription = {
  id: string;
  place_id: string;
  name: string | null;
  photo: string | null;
  tier: BoostTier;
  interval: BoostInterval;
  amount_cents: number;
  /** The end of the paid period; it renews then when `renews`. */
  ends_at: string | null;
  renews: boolean;
  pending: { tier: BoostTier; interval: BoostInterval | null } | null;
  /** Whether you still run the place (its Billing page opens for you). */
  runs_place: boolean;
};

export async function listBilling(sessionId?: string | null): Promise<Result<{ subscriptions: MySubscription[]; outcome?: string }>> {
  const r = await efInvoke<{ subscriptions: MySubscription[]; outcome?: string }>(
    "business-web-list-billing",
    sessionId ? { session_id: sessionId } : {},
  );
  if (!r.ok) return fail(r);
  return { ok: true, data: { subscriptions: r.data.subscriptions ?? [], outcome: r.data.outcome } };
}

/** Stop renewing a subscription you pay, by its id; no place access needed. */
export async function stopMyPremier(backingId: string): Promise<Result<null>> {
  const r = await efInvoke<{ ok: true }>("business-web-cancel-premier", { backing_id: backingId });
  if (!r.ok) return fail(r);
  return { ok: true, data: null };
}

export async function startPremier(input: {
  placeId: string;
  tier?: BoostTier;
  interval?: BoostInterval;
  updateCard?: boolean;
  returnUrl: string;
}): Promise<Result<{ url: string | null; outcome?: string }>> {
  const body = input.updateCard
    ? { place_id: input.placeId, kind: "update_card", return_url: input.returnUrl }
    : { place_id: input.placeId, tier: input.tier, interval: input.interval, return_url: input.returnUrl };
  const r = await efInvoke<{ url: string | null; outcome?: string }>("business-web-start-premier", body);
  if (!r.ok) return fail(r);
  return { ok: true, data: { url: r.data.url ?? null, outcome: r.data.outcome } };
}

export async function cancelPremier(placeId: string, asPlace: boolean): Promise<Result<null>> {
  const r = await efInvoke<{ ok: true }>("business-web-cancel-premier", { place_id: placeId, as_place: asPlace });
  if (!r.ok) return fail(r);
  return { ok: true, data: null };
}

// ── Claim requests (Mesita staff) ────────────────────────────────────────────

export type OwnerView = {
  id: string;
  consumer_id: string;
  name: string | null;
  phone: string | null;
  instagram_handle: string | null;
  member_number: string | null;
  method: string;
  verified_at: string;
  expires_at: string;
  live: boolean;
};

export type PendingRequest = {
  id: string;
  place_id: string;
  place_name: string | null;
  consumer_id: string;
  name: string;
  role: string;
  /** The WhatsApp number to write to (MESITA-3127). */
  contact: string | null;
  note: string | null;
  created_at: string;
  phone: string | null;
  instagram_handle: string | null;
  member_number: string | null;
};

export async function listVerifications(placeId?: string): Promise<Result<{ owners: OwnerView[]; pending: PendingRequest[] }>> {
  const r = await efInvoke<{ owners: OwnerView[]; pending: PendingRequest[] }>(
    "business-web-list-verifications",
    placeId ? { place_id: placeId } : {},
  );
  if (!r.ok) return fail(r);
  return { ok: true, data: { owners: r.data.owners ?? [], pending: r.data.pending ?? [] } };
}

export async function decideVerification(
  input: { requestId: string; decision: "approve" | "reject"; note?: string } | { managerId: string; decision: "revoke"; note?: string },
): Promise<Result<null>> {
  const body = "managerId" in input
    ? { manager_id: input.managerId, decision: "revoke", note: input.note }
    : { request_id: input.requestId, decision: input.decision, note: input.note };
  const r = await efInvoke<{ ok: true }>("business-web-decide-verification", body);
  if (!r.ok) return fail(r);
  return { ok: true, data: null };
}

// ── Payments (MESITA-3296) ──────────────────────────────────────────────

/** The owner's switches. `pay_cards` is the Mesita Payments switch (MESITA-3396; the key is
 *  never renamed, renaming resets live config). Cash and Credits left with
 *  MESITA-3408. Mirrors PAYMENT_KEYS in supabase/_shared/payments.ts. */
/** The owner's on/off switches (Main §10, MESITA-3589): Loyalty Cards, Cash
 *  Payments, Mesita Payments (`pay_cards`), Mesita Prepayments
 *  (`prepayments`, MESITA-3597) and its six vouchers. */
export type PaymentKey =
  /** MESITA-3946: Accept Stripe Payments, over App Payments and App Prepayments. */
  | "stripe_payments"
  | "loyalty_cards"
  | "cash_payments"
  | "pay_cards"
  | "prepayments"
  | "voucher_welcome"
  | "voucher_200"
  | "voucher_1000"
  | "voucher_5000"
  | "voucher_vip";
export type PaymentSettings = Record<PaymentKey, boolean>;
/** The Loyalty Cards Agreement (MESITA-3589), independent of Stripe. */
export type LoyaltyCardsContract = { signed: boolean; signed_at: string | null; terms_version: string | null; text?: string };
/** The Stripe Account's seven values (Main §10). */
export type StripeStage = "none" | "onboarding" | "in_review" | "connected" | "action_needed" | "payouts_paused" | "restricted";
export type PaymentAccount = {
  state: "none" | "onboarding" | "ready" | "restricted";
  /** Main §10's seven values; older servers lack it. */
  stage?: StripeStage;
  livemode: boolean;
  country: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_due: number;
};
export type PlacePayments = {
  can_edit: boolean;
  test_mode: boolean;
  account: PaymentAccount;
  settings: PaymentSettings;
  /** MESITA-3913: the one currency of this place's Loyalty Cards, from its
   *  country ("MXN", "USD"). Older servers lack it: MXN. */
  currency: string;
  /** The Loyalty Cards Agreement (MESITA-3589); older servers lack it. */
  contract?: LoyaltyCardsContract;
  /** Whether a waiter has a code (MESITA-4871). */
  code_set: boolean;
  waiters: PlaceWaiter[];
  /** MESITA-3946: credit guests hold here now; null when the read failed. */
  credits_balance: { available_cents: number; pending_cents: number } | null;
  /** Mesita's fee invoice (MESITA-3461): hold = card payments are off until
   *  it is paid; invoice = the one to pay, on Stripe's page. */
  fee: PlaceFee;
  /** MESITA-4502: cash amounts waiting for Received. Not tickets. */
  cash_due?: { attempt_id: string; cash_cents: number; credit_cents?: number; guest_label: string; created_at: string }[];
  /** MESITA-4698: the three cashback lines (Welcome Everyone, Returning
   *  Regular, Returning VIP; MESITA-4766) and the voucher bonuses, in basis
   *  points; older servers lack it. */
  cashback?: CashbackRates;
  /** MESITA-4732: the place's credit limit and the step that raises it;
   *  older servers lack it (null: the Credit Limit box hides). */
  credit_limit: CreditLimit | null;
};

/** MESITA-4732: own admin-set limit ("custom") wins; MXN places step
 *  none → credits (MX$10,000) → stripe (MX$50,000); others keep "default". */
export type CreditLimit = {
  limit_cents: number | null;
  outstanding_cents: number;
  currency: string;
  tier: "none" | "credits" | "stripe" | "custom" | "default";
  next: { step: "credits" | "stripe"; limit_cents: number } | null;
};

function readCreditLimit(v: unknown): CreditLimit | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const tiers = ["none", "credits", "stripe", "custom", "default"] as const;
  const tier = tiers.find((t) => t === o.tier);
  if (!tier) return null;
  const n = o.next as Record<string, unknown> | null | undefined;
  return {
    limit_cents: typeof o.limit_cents === "number" ? o.limit_cents : null,
    outstanding_cents: Number(o.outstanding_cents) || 0,
    currency: typeof o.currency === "string" ? o.currency.toUpperCase() : "MXN",
    tier,
    next: n && (n.step === "credits" || n.step === "stripe") && typeof n.limit_cents === "number" ? { step: n.step, limit_cents: n.limit_cents } : null,
  };
}


export type PlaceFee = {
  hold: boolean;
  invoice: null | { amount_cents: number; currency: string; due_at: string | null; url: string | null; overdue: boolean };
};

/** The Stripe account as Stripe last said it stands, and every switch. */
export async function getPlacePayments(placeId: string): Promise<Result<PlacePayments>> {
  const r = await efInvoke<PlacePayments>("business-web-get-payments", { place_id: placeId });
  if (!r.ok) return fail(r);
  return {
    ok: true,
    data: {
      can_edit: r.data.can_edit,
      test_mode: r.data.test_mode,
      account: r.data.account,
      settings: r.data.settings,
      currency: typeof r.data.currency === "string" ? r.data.currency.toUpperCase() : "MXN",
      // MESITA-3599: dropped here, every reload read the signed agreement as "Not signed".
      contract: r.data.contract,
      code_set: r.data.code_set === true,
      waiters: Array.isArray(r.data.waiters) ? r.data.waiters : [],
      credits_balance: r.data.credits_balance
        ? {
            available_cents: Number(r.data.credits_balance.available_cents) || 0,
            pending_cents: Number(r.data.credits_balance.pending_cents) || 0,
          }
        : null,
      fee: { hold: r.data.fee?.hold === true, invoice: r.data.fee?.invoice ?? null },
      cash_due: Array.isArray(r.data.cash_due) ? r.data.cash_due : [],
      cashback: r.data.cashback ? readCashback(r.data.cashback) : CASHBACK_DEFAULTS,
      credit_limit: readCreditLimit(r.data.credit_limit),
    },
  };
}

// ── Monitor lists (MESITA-4538) ─────────────────────────

/** One page of a Monitor list: visits, vouchers, payments or credits, each
 *  row with the ids of the rows it relates to. Owners and
 *  Mesita staff only; an editor gets `owner_only`. */
export async function listMonitor(
  placeId: string,
  kind: MonitorKind,
  filter: MonitorFilter = {},
  before?: MonitorCursor,
): Promise<Result<MonitorPage>> {
  const r = await efInvoke<MonitorPage>("business-web-list-place-monitor", {
    place_id: placeId,
    kind,
    ...(filter.customer ? { customer: filter.customer } : {}),
    ...(filter.id ? { id: filter.id } : {}),
    ...(before ? { before } : {}),
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: { ...r.data, kind, rows: r.data.rows ?? [], next: r.data.next ?? null } };
}

/** Monitor › Customers: guests with money rows here, what the place owes each. */
export async function listCustomers(placeId: string, customer?: string | null, before?: CustomerCursor): Promise<Result<CustomersPage>> {
  const r = await efInvoke<CustomersPage>("business-web-list-place-customers", {
    place_id: placeId,
    ...(customer ? { customer } : {}),
    ...(before ? { before } : {}),
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: { ...r.data, rows: r.data.rows ?? [], next: r.data.next ?? null } };
}

/** Payouts to the place's bank, read live from Stripe. */
export async function getPayouts(placeId: string, before?: string | null): Promise<Result<PayoutsAnswer>> {
  const r = await efInvoke<PayoutsAnswer>("business-web-get-place-payouts", {
    place_id: placeId,
    ...(before ? { before } : {}),
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data };
}

/** What one owner refund gave back (MESITA-3381): the card part through
 *  Stripe, then the credit part as credit. */
export type MoneyRefund = { card_refunded_cents: number; credit_refunded_cents: number; status: string | null };

/** The owner refunds one row of their own place, full (no amount) or partial.
 *  Owners and Mesita staff only; an editor gets `forbidden`. */
export async function refundPlaceMoneyRow(
  placeId: string,
  row: { kind: "voucher" | "payment"; id: string },
  amountCents: number | null,
): Promise<Result<MoneyRefund>> {
  const r = await efInvoke<MoneyRefund>("business-web-refund-payment", {
    place_id: placeId,
    kind: row.kind === "voucher" ? "purchase" : "payment",
    id: row.id,
    ...(amountCents ? { amount_cents: amountCents } : {}),
  });
  if (!r.ok) return fail(r);
  return {
    ok: true,
    data: { card_refunded_cents: r.data.card_refunded_cents, credit_refunded_cents: r.data.credit_refunded_cents, status: r.data.status ?? null },
  };
}

/** One switch: a way to pay or one voucher. Returns every switch as it now stands. */
export async function receiveGuestCash(placeId: string, attemptId: string, amountCents: number): Promise<Result<{ outcome: string }>> {
  const r = await efInvoke<{ outcome: string }>("business-web-receive-cash", {
    place_id: placeId,
    attempt_id: attemptId,
    amount_cents: amountCents,
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: { outcome: r.data.outcome } };
}

export async function setPlacePayment(placeId: string, key: PaymentKey, enabled: boolean): Promise<Result<PaymentSettings>> {
  const r = await efInvoke<{ settings: PaymentSettings }>("business-web-set-payment", { place_id: placeId, key, enabled });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data.settings };
}

/** MESITA-4698: save the place's three cashback lines (MESITA-4766) and the
 *  voucher bonuses; exactly these fields go to the server. */
export async function setPlaceCashback(placeId: string, rates: CashbackRates): Promise<Result<CashbackRates>> {
  const r = await efInvoke<{ cashback: CashbackRates }>("business-web-set-cashback", { place_id: placeId, ...readCashback(rates) });
  if (!r.ok) return fail(r);
  return { ok: true, data: readCashback(r.data.cashback) };
}

/** The owner agrees to the Loyalty Cards Agreement (MESITA-3589). */
export async function signLoyaltyCardsContract(placeId: string): Promise<Result<LoyaltyCardsContract>> {
  const r = await efInvoke<{ contract: LoyaltyCardsContract }>("business-web-sign-loyalty-cards-contract", { place_id: placeId });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data.contract };
}

/** Creates the place's Stripe account if it has none and answers Stripe's hosted setup. */
export async function startPaymentOnboarding(placeId: string, returnUrl: string): Promise<Result<{ url: string }>> {
  const r = await efInvoke<{ url: string }>("business-web-start-payment-onboarding", { place_id: placeId, return_url: returnUrl });
  if (!r.ok) return fail(r);
  return { ok: true, data: { url: r.data.url } };
}

/** A one-time link into the place's Stripe dashboard. */
export async function openPaymentDashboard(placeId: string): Promise<Result<{ url: string }>> {
  const r = await efInvoke<{ url: string }>("business-web-open-payment-dashboard", { place_id: placeId });
  if (!r.ok) return fail(r);
  return { ok: true, data: { url: r.data.url } };
}

/** One waiter, their tips (MESITA-4871) and their code (MESITA-4886; null for
 *  an editor, a removed waiter, or a code made before it was kept). */
export type PlaceWaiter = {
  id: string;
  name: string;
  removed: boolean;
  tips_24h_cents: number;
  bills_24h: number;
  tips_7d_cents: number;
  bills_7d: number;
  code?: string | null;
};

/** Add a waiter, replace their 8-digit code or remove them. */
export async function setWaiter(
  placeId: string,
  body: { action: "add"; name: string } | { action: "new_code" | "remove"; waiter_id: string },
): Promise<Result<{ waiter_id: string; name: string; code?: string }>> {
  const r = await efInvoke<{ waiter_id: string; name: string; code?: string }>("business-web-set-waiter", { place_id: placeId, ...body });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data };
}

// ── Views (MESITA-3206) ──────────────────────────

export type PlaceViewsDay = { day: string; views: number; likes: number; shares: number };

/** Synthesized by the EF from the raw view events on every load (MESITA-4675). */
export type PlaceViewsAnalytics = {
  views: number;
  /** Signed-out opens (MESITA-4678): never customers. */
  anonymous: number;
  viewers: number;
  returning: number;
  views7d: number;
  views30d: number;
  viewers30d: number;
};

export type PlaceViews = {
  views: number;
  likes: number;
  shares: number;
  timezone: string;
  days: PlaceViewsDay[];
  analytics: PlaceViewsAnalytics;
};

const NO_ANALYTICS: PlaceViewsAnalytics = { views: 0, anonymous: 0, viewers: 0, returning: 0, views7d: 0, views30d: 0, viewers30d: 0 };

export async function getPlaceViews(placeId: string): Promise<Result<PlaceViews>> {
  const r = await efInvoke<PlaceViews>("business-web-get-place-views", { place_id: placeId });
  if (!r.ok) return fail(r);
  const { views, likes, shares, timezone, days, analytics } = r.data;
  return {
    ok: true,
    data: { views, likes, shares, timezone, days: days ?? [], analytics: analytics ?? { ...NO_ANALYTICS, views } },
  };
}

// ── Views log (MESITA-3213) ──────────────────────

export type PlaceViewEvent = {
  /** The stored kinds; `saved` reads "liked". */
  kind: "viewed" | "saved" | "shared";
  at: string;
  /** The viewer's per-place customer key (MESITA-4538). */
  customer: string | null;
  person: {
    name: string;
    avatarUrl: string | null;
    handle: string | null;
    followers: number;
    guestClass: "regular" | "vip";
    instagram: boolean;
  };
};

export type PlaceViewsLog = { events: PlaceViewEvent[]; next: string | null };

export async function listPlaceViewsLog(placeId: string, before?: string, customer?: string | null): Promise<Result<PlaceViewsLog>> {
  const r = await efInvoke<PlaceViewsLog>("business-web-list-place-views-log", {
    place_id: placeId,
    ...(before ? { before } : {}),
    ...(customer ? { customer } : {}),
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: { events: r.data.events ?? [], next: r.data.next ?? null } };
}
