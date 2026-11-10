// Selling vouchers (MESITA-3303, W1b). What a place offers a guest right now,
// and the one Checkout that buys a voucher on the place's own Stripe Connect
// account: a direct charge with no application fee (charge model d5a,
// MESITA-3461); Mesita's fee is stored on the row and billed to the place apart.
//
// The ledger is W1a's (wallet_purchases, wallet_balance); the gate is
// moneyState; the catalog and the rates are money.ts. Nothing here computes
// a price for the client: the client shows what this answers.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type StripeCall, StripeError } from "./boost.ts";
import { MESITA_FEE_BPS_VOUCHER, MIN_CHARGE_CENTS, MONEY_CURRENCY, VOUCHER_CATALOG, voucherBonusCents, voucherFeeCents } from "./money.ts";
import type { MoneyCode } from "./money-codes.ts";
import { MONEY_VOUCHER_KEYS, type MoneyVoucherKey, moneyState, STORY_MIN_FOLLOWERS, type VoucherReason } from "./money-state.ts";
import { type AccountRow, type PaymentSettings, readAccount, readSettings } from "./payments.ts";
import { readMoneyConfig } from "./money-config.ts";
import { readInstagramSyncState, readVipStanding } from "./consumer-doc.ts";
import { readVoucherPlace, type VoucherPlace, WALLET_CHECKOUT_TTL_SEC } from "./wallet.ts";
import { PER_VISIT_VOUCHERS, type PerVisitVoucher, perVisitSpent, readVisitCount } from "./visits.ts";

export type PlaceBalance = { available_cents: number; pending_cents: number; held_cents: number; spendable_cents: number };

/** One catalog line as the client shows it: the price, the bonus, and the
 *  credit the guest ends up with (the sum, so no client adds). */
export type VoucherCatalogLine = { price_cents: number; bonus_cents: number; credit_cents: number; available_after_sec: number };

/** What the place screen's Vouchers tab and the buy door read. */
export type VoucherOffer = {
  test_mode: boolean;
  currency: string;
  charges_enabled: boolean;
  cashback: boolean;
  /** A bill paid to the waiter earns cashback here (Cash Payments Cashback;
   *  MESITA-3545, the place's own rate since MESITA-3589). */
  outside_cashback: boolean;
  /** The place's rates now, in bps (0 = Off or not usable; MESITA-3589):
   *  the card part (Mesita Payments Cashback) and the cash bill part (Cash
   *  Payments Cashback). Never on the tip or the credit part. */
  card_cashback_bps: number;
  cash_cashback_bps: number;
  /** House Credits is On here: new credit can be born. Off never stops a
   *  guest spending what they already hold. */
  house_credits: boolean;
  /** Cash Payments is On here (the owner's switch and the place code). */
  cash: boolean;
  /** The green Mesita Payments mark, moneyState's, before the pause and
   *  Welcome-used filters so the place screen and the list rows agree. */
  mesita_pay: boolean;
  /** The owner's switches, as before (MESITA-3299 readers keep working). */
  vouchers: Record<MoneyVoucherKey, boolean>;
  /** The vouchers a guest can buy here now. */
  sell: MoneyVoucherKey[];
  /** Every other voucher and why. */
  unavailable: Partial<Record<MoneyVoucherKey, VoucherReason>>;
  catalog: Record<MoneyVoucherKey, VoucherCatalogLine>;
  /** The signed-in guest's credit at this place; null when anonymous. */
  balance: PlaceBalance | null;
  paused: boolean;
};

export const CATALOG_LINES: Record<MoneyVoucherKey, VoucherCatalogLine> = Object.fromEntries(
  MONEY_VOUCHER_KEYS.map((k) => [k, {
    price_cents: VOUCHER_CATALOG[k].price_cents,
    bonus_cents: voucherBonusCents(k),
    credit_cents: VOUCHER_CATALOG[k].price_cents + voucherBonusCents(k),
    available_after_sec: VOUCHER_CATALOG[k].available_after_sec,
  }]),
) as Record<MoneyVoucherKey, VoucherCatalogLine>;

/** The connected account's currency, from its country: Stripe's default
 *  currency is not stored, and a MX account settles in pesos. */
const COUNTRY_CURRENCY: Record<string, string> = { MX: "mxn", US: "usd" };

export function accountCurrency(account: AccountRow | null): string | null {
  const c = account?.account_country;
  return c ? COUNTRY_CURRENCY[c] ?? null : null;
}

export type OfferInput = {
  settings: PaymentSettings;
  account: AccountRow | null;
  /** The key's universe; an account from the other one cannot charge here. */
  livemode: boolean;
  currency: string;
  paused: boolean;
  balance: PlaceBalance | null;
  /** Welcome once: this guest already bought one here, or has paid here. */
  welcomeUsed: boolean;
  /** Story and VIP, one each new visit (MESITA-3463): true when this guest
   *  already bought one here for every visit they made. Absent reads false. */
  perVisitUsed?: Partial<Record<PerVisitVoucher, boolean>>;
  /** The place has a place code, so the waiter's charge can open (MESITA-3545). */
  hasPlaceCode?: boolean;
};

/** The pure half of the offer. */
export function offerFrom(i: OfferInput): VoucherOffer {
  const usable = !!i.account && i.account.livemode === i.livemode && i.account.charges_enabled;
  const state = moneyState(
    { ...i.settings, has_place_code: i.hasPlaceCode === true },
    { charges_enabled: usable, fee_hold: usable && i.account?.fee_hold === true },
    i.balance ? { spendable_cents: i.balance.spendable_cents } : null,
  );
  const unavailable = { ...state.unavailable };
  const sell: MoneyVoucherKey[] = [];
  for (const k of state.sell) {
    if (i.paused) unavailable[k] = "paused";
    else if (k === "voucher_welcome" && i.welcomeUsed) unavailable[k] = "used";
    else if (i.perVisitUsed?.[k as PerVisitVoucher]) unavailable[k] = "needs_visit";
    else sell.push(k);
  }
  // The guest's offer carries the voucher switches alone; the Mesita Payments switch
  // (MESITA-3396) is already folded into `cashback` and the mark.
  const vouchers = Object.fromEntries(MONEY_VOUCHER_KEYS.map((k) => [k, i.settings[k] === true])) as Record<MoneyVoucherKey, boolean>;
  return {
    test_mode: !i.livemode,
    currency: i.currency,
    charges_enabled: usable,
    cashback: state.cashback,
    outside_cashback: state.outside_cashback,
    card_cashback_bps: state.card_cashback_bps,
    cash_cashback_bps: state.cash_cashback_bps,
    house_credits: state.house_credits,
    cash: state.cash,
    mesita_pay: state.mesita_pay,
    vouchers,
    sell,
    unavailable,
    catalog: CATALOG_LINES,
    balance: i.balance,
    paused: i.paused,
  };
}

/** The guest's credit at the place, from the ledger. Null for an anonymous
 *  caller. */
export async function readPlaceBalance(
  admin: SupabaseClient,
  consumerId: string | null,
  placeId: string,
  currency: string,
  livemode: boolean,
): Promise<PlaceBalance | null> {
  if (!consumerId) return null;
  const { data, error } = await admin.rpc("wallet_balance", {
    p_consumer_id: consumerId,
    p_place_id: placeId,
    p_currency: currency,
    p_livemode: livemode,
  });
  if (error) throw new Error(`wallet_balance: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as PlaceBalance | null | undefined;
  return row ?? { available_cents: 0, pending_cents: 0, held_cents: 0, spendable_cents: 0 };
}

/** Welcome is once per guest per place, and only before any Mesita payment
 *  there: a Welcome purchase that is not expired or failed, or a paid
 *  payment, both count. */
export async function readWelcomeUsed(admin: SupabaseClient, consumerId: string | null, placeId: string): Promise<boolean> {
  if (!consumerId) return false;
  const [p, w] = await Promise.all([
    admin.from("wallet_purchases").select("id").eq("consumer_id", consumerId).eq("place_id", placeId)
      .eq("voucher", "voucher_welcome").not("status", "in", "(expired,failed)").limit(1),
    admin.from("wallet_payments").select("id").eq("consumer_id", consumerId).eq("place_id", placeId)
      .in("status", ["paid", "refunded", "partly_refunded", "needs_review"]).limit(1),
  ]);
  if (p.error) throw new Error(`wallet_purchases: ${p.error.message}`);
  if (w.error) throw new Error(`wallet_payments: ${w.error.message}`);
  return (p.data ?? []).length > 0 || (w.data ?? []).length > 0;
}

/** Story and VIP, one each new visit (MESITA-3463): each is spent when the
 *  guest's live purchases of it here (not expired or failed) outnumber
 *  their visits here (visits.ts). */
export async function readPerVisitUsed(
  admin: SupabaseClient,
  consumerId: string | null,
  placeId: string,
): Promise<Partial<Record<PerVisitVoucher, boolean>>> {
  if (!consumerId) return {};
  const [visits, bought] = await Promise.all([
    readVisitCount(admin, consumerId, placeId),
    admin.from("wallet_purchases").select("voucher").eq("consumer_id", consumerId).eq("place_id", placeId)
      .in("voucher", [...PER_VISIT_VOUCHERS]).not("status", "in", "(expired,failed)"),
  ]);
  if (bought.error) throw new Error(`wallet_purchases: ${bought.error.message}`);
  const rows = (bought.data ?? []) as Array<{ voucher: string }>;
  const out: Partial<Record<PerVisitVoucher, boolean>> = {};
  for (const k of PER_VISIT_VOUCHERS) {
    out[k] = perVisitSpent(rows.filter((r) => r.voucher === k).length, visits);
  }
  return out;
}

/** The whole offer for one place and one (maybe anonymous) guest. */
export async function voucherOffer(
  admin: SupabaseClient,
  place: VoucherPlace,
  consumerId: string | null,
  livemode: boolean,
): Promise<VoucherOffer> {
  const currency = String(place.currency ?? MONEY_CURRENCY).toLowerCase();
  const [settings, account, config, balance, welcomeUsed, perVisitUsed, code] = await Promise.all([
    readSettings(admin, place.id),
    readAccount(admin, place.id),
    readMoneyConfig(admin),
    readPlaceBalance(admin, consumerId, place.id, currency, livemode),
    readWelcomeUsed(admin, consumerId, place.id),
    readPerVisitUsed(admin, consumerId, place.id),
    admin.from("place_codes").select("place_id").eq("place_id", place.id).maybeSingle(),
  ]);
  // A failed read reads no code: Offers never advertises 2% it cannot honour.
  if (code.error) console.error("[vouchers] place_code_read", JSON.stringify({ place_id: place.id, error: code.error.message }));
  return offerFrom({
    settings,
    account,
    livemode,
    currency,
    paused: config.buying_paused,
    balance,
    welcomeUsed,
    perVisitUsed,
    hasPlaceCode: !code.error && !!code.data,
  });
}

// ── Buying ─────────────────────────────────────────────────────────────────

export type BuyRefusal = { ok: false; status: number; code: MoneyCode; error: string; url?: string };
export type BuyOk = { ok: true; url: string; purchase_id: string };

export const REFUSAL_FOR: Record<VoucherReason, { code: MoneyCode; error: string }> = {
  off: { code: "not_available", error: "This place does not sell that voucher" },
  needs_account: { code: "no_account", error: "This place has not connected payments yet" },
  needs_house_credits: { code: "not_available", error: "This place doesn't accept prepayments" },
  needs_billing: { code: "not_available", error: "This place doesn't accept prepayments right now" },
  not_yet: { code: "not_yet", error: "This voucher is not on sale yet" },
  needs_card_payments: { code: "needs_card_payments", error: "This voucher needs card payments, which are not on yet" },
  needs_instagram: { code: "needs_instagram", error: "This voucher needs the Instagram connection, which is not on yet" },
  paused: { code: "paused", error: "Voucher sales are paused for a moment" },
  used: { code: "welcome_used", error: "You already had your Welcome voucher here" },
  needs_visit: { code: "needs_visit", error: "One each visit: pay a bill here by card to buy it again" },
};

/** Why a voucher cannot be bought right now, or null when it can. */
export function buyRefusal(offer: VoucherOffer, voucher: MoneyVoucherKey, account: AccountRow | null): BuyRefusal | null {
  if (offer.currency !== MONEY_CURRENCY) {
    return { ok: false, status: 409, code: "currency_mismatch", error: "Vouchers are sold in Mexican pesos only" };
  }
  const acctCurrency = accountCurrency(account);
  if (offer.charges_enabled && acctCurrency && acctCurrency !== offer.currency) {
    return { ok: false, status: 409, code: "currency_mismatch", error: "This place's Stripe account does not settle in its currency" };
  }
  if (!offer.sell.includes(voucher)) {
    const reason = offer.unavailable[voucher] ?? "off";
    return { ok: false, status: 409, ...REFUSAL_FOR[reason] };
  }
  const min = MIN_CHARGE_CENTS[offer.currency] ?? 0;
  if (CATALOG_LINES[voucher].price_cents < min) {
    return { ok: false, status: 409, code: "below_minimum", error: "This amount is below Stripe's minimum charge" };
  }
  return null;
}

/** The guest's own Instagram, as `consumers` stores it. */
export type StoryGuest = { instagram_handle: string | null; instagram_followers_count: number | null } | null;

/** Story's guest gate (MESITA-3507): a linked Instagram with MORE than
 *  STORY_MIN_FOLLOWERS followers. Null when the guest may buy it. Any other
 *  voucher passes. */
export function storyRefusal(voucher: MoneyVoucherKey, guest: StoryGuest): BuyRefusal | null {
  if (voucher !== "voucher_story") return null;
  if (!guest?.instagram_handle) {
    return { ok: false, status: 409, code: "needs_instagram", error: "Link your Instagram to buy the Story voucher" };
  }
  if ((guest.instagram_followers_count ?? 0) <= STORY_MIN_FOLLOWERS) {
    return {
      ok: false,
      status: 409,
      code: "few_followers",
      error: `The Story voucher is for Instagram accounts with more than ${STORY_MIN_FOLLOWERS.toLocaleString("en-US")} followers`,
    };
  }
  return null;
}

/** The buying guest's Instagram, for storyRefusal, through the consumer door. */
export async function readStoryGuest(admin: SupabaseClient, consumerId: string): Promise<StoryGuest> {
  const res = await readInstagramSyncState(admin, consumerId);
  if (!res.ok) throw new Error(`consumers: ${res.error}`);
  if (res.deleted) return null;
  return { instagram_handle: res.handle, instagram_followers_count: res.followers };
}

/** The buying guest's class (MESITA-3550): the class and the last day it
 *  holds (null = no end). How often VIP sells is MESITA-3463's, one each
 *  new visit, in the offer. */
export type VipGuest = { guest_class: string | null; vip_until: string | null } | null;

/** VIP's guest gate (MESITA-3550): the VIP class, not past `vip_until`
 *  (compared as YYYY-MM-DD in Mexico City). Null when the guest may buy it.
 *  Any other voucher passes. */
export function vipRefusal(voucher: MoneyVoucherKey, guest: VipGuest, today: string): BuyRefusal | null {
  if (voucher !== "voucher_vip") return null;
  if (guest?.guest_class !== "vip" || (guest.vip_until !== null && guest.vip_until.slice(0, 10) < today)) {
    return { ok: false, status: 409, code: "not_vip", error: "The VIP voucher is for VIP guests" };
  }
  return null;
}

/** Today's date in Mexico City, YYYY-MM-DD, for vip_until. */
export function mexicoToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(now);
}

/** The buying guest's class, for vipRefusal, through the consumer door. */
export async function readVipGuest(admin: SupabaseClient, consumerId: string): Promise<VipGuest> {
  const res = await readVipStanding(admin, consumerId);
  if (!res.ok) throw new Error(`consumers: ${res.message}`);
  return res.row;
}

/** Stripe Checkout on the connected account. The ledger row id rides in
 *  metadata and client_reference_id so the receiver (W2b) finds it even
 *  before the session id is stored; no application fee (MESITA-3461); no
 *  platform customer (premier_customers stays Premier's). */
export function voucherCheckoutParams(args: {
  purchaseId: string;
  placeId: string;
  consumerId: string;
  email: string | null;
  voucher: MoneyVoucherKey;
  currency: string;
  placeName: string;
  returnUrl: string;
  nowSec: number;
}): Record<string, unknown> {
  const line = CATALOG_LINES[args.voucher];
  const origin = new URL(args.returnUrl).origin;
  const metadata = voucherMetadata(args);
  return {
    mode: "payment",
    client_reference_id: args.purchaseId,
    ...(args.email ? { customer_email: args.email } : {}),
    success_url: `${origin}/wallet?prepay={CHECKOUT_SESSION_ID}`,
    cancel_url: args.returnUrl,
    expires_at: args.nowSec + WALLET_CHECKOUT_TTL_SEC,
    metadata,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: args.currency,
        unit_amount: line.price_cents,
        product_data: {
          name: `${voucherName(args.voucher)} · ${args.placeName}`.slice(0, 250),
          description: `${pesos(line.credit_cents)} of credit at ${args.placeName}`.slice(0, 250),
        },
      },
    }],
    payment_intent_data: { metadata },
  };
}

/** What a voucher's Stripe object carries, the Checkout's and the saved
 *  card's PaymentIntent alike (MESITA-3552): the receiver reads
 *  mesita_kind and purchase_id. */
export function voucherMetadata(args: { purchaseId: string; placeId: string; consumerId: string; voucher: MoneyVoucherKey }): Record<string, string> {
  const line = CATALOG_LINES[args.voucher];
  return {
    mesita_kind: "wallet_voucher",
    purchase_id: args.purchaseId,
    place_id: args.placeId,
    consumer_id: args.consumerId,
    voucher: args.voucher,
    amount_cents: String(line.price_cents),
    bonus_cents: String(line.bonus_cents),
  };
}

export function voucherName(k: MoneyVoucherKey): string {
  switch (k) {
    case "voucher_200": return "$200MX voucher";
    case "voucher_1000": return "$1,000MX voucher";
    case "voucher_5000": return "$5,000MX voucher";
    case "voucher_welcome": return "Welcome voucher";
    case "voucher_story": return "Story voucher";
    case "voucher_vip": return "VIP voucher";
  }
}

function pesos(cents: number): string {
  return `$${Math.floor(cents / 100).toLocaleString("en-US")}MX`;
}

export type PurchaseRow = { id: string; status: string; stripe_checkout_session_id: string | null };

/** The test-mode cap on a place's outstanding credit across every guest
 *  (MESITA-3305 rule 15, d5a): MX$20,000. One global constant, no lock. */
export const PLACE_CAP_CENTS = 20_000_00;

/** Would this buy push the place past the cap? Pure. Live mode has no cap. */
export function overPlaceCap(outstandingCents: number, voucher: MoneyVoucherKey, livemode: boolean): boolean {
  if (livemode) return false;
  return outstandingCents + CATALOG_LINES[voucher].credit_cents > PLACE_CAP_CENTS;
}

/** The place's outstanding credit, Available plus Pending, every guest. */
export async function readPlaceOutstanding(admin: SupabaseClient, placeId: string, currency: string, livemode: boolean): Promise<number> {
  const { data, error } = await admin.rpc("wallet_place_outstanding", { p_place_id: placeId, p_currency: currency, p_livemode: livemode });
  if (error) throw new Error(`wallet_place_outstanding: ${error.message}`);
  return typeof data === "number" ? data : Number(data ?? 0);
}

/** The cap, then one `opening` row under the guest's request_id; the
 *  Checkout path and the saved-card path (MESITA-3552) both start here.
 *  `duplicate`: the request_id (or Welcome's once-per-guest index) already
 *  has a row; the caller resumes it. */
export async function openPurchaseRow(
  admin: SupabaseClient,
  args: {
    consumerId: string;
    place: VoucherPlace;
    account: AccountRow;
    voucher: MoneyVoucherKey;
    currency: string;
    requestId: string;
    livemode: boolean;
  },
): Promise<{ ok: true; duplicate: false; purchaseId: string } | { ok: true; duplicate: true } | BuyRefusal> {
  const line = CATALOG_LINES[args.voucher];
  // The test-mode cap (rule 15): read once, no lock.
  const outstanding = await readPlaceOutstanding(admin, args.place.id, args.currency, args.livemode);
  if (overPlaceCap(outstanding, args.voucher, args.livemode)) {
    return { ok: false, status: 409, code: "place_cap", error: "This place has reached its test-mode credit cap" };
  }
  const { data: row, error: insertErr } = await admin
    .from("wallet_purchases")
    .insert({
      consumer_id: args.consumerId,
      place_id: args.place.id,
      amount_cents: line.price_cents,
      currency: args.currency,
      status: "opening",
      livemode: args.livemode,
      stripe_account_id: args.account.stripe_account_id,
      voucher: args.voucher,
      bonus_cents: line.bonus_cents,
      application_fee_cents: voucherFeeCents(args.voucher),
      request_id: args.requestId,
    })
    .select("id")
    .single();
  if (insertErr) {
    if (insertErr.code === "23505") return { ok: true, duplicate: true };
    throw new Error(`purchase_insert: ${insertErr.message}`);
  }
  return { ok: true, duplicate: false, purchaseId: String((row as { id: string }).id) };
}

/** The buy, after every refusal was checked: one `opening` row under the
 *  guest's request_id, one Checkout on the connected account keyed by the
 *  row id, then the row reads `open` with its session. A Stripe refusal
 *  marks the row `failed` and answers 502 checkout_failed. A repeated
 *  request_id finds its row: an open session's url again, or a refusal. */
export async function openVoucherCheckout(
  admin: SupabaseClient,
  stripe: StripeCall,
  args: {
    consumerId: string;
    email: string | null;
    place: VoucherPlace;
    account: AccountRow;
    voucher: MoneyVoucherKey;
    currency: string;
    requestId: string;
    returnUrl: string;
    livemode: boolean;
    nowSec: number;
  },
): Promise<BuyOk | BuyRefusal> {
  const opened = await openPurchaseRow(admin, args);
  if (!opened.ok) return opened;
  if (opened.duplicate) {
    return await resumeRequest(admin, stripe, {
      consumerId: args.consumerId,
      requestId: args.requestId,
      account: args.account,
      place: args.place,
      voucher: args.voucher,
    });
  }
  const purchaseId = opened.purchaseId;

  let session: Record<string, unknown>;
  try {
    session = await stripe(
      "POST",
      "checkout/sessions",
      voucherCheckoutParams({
        purchaseId,
        placeId: args.place.id,
        consumerId: args.consumerId,
        email: args.email,
        voucher: args.voucher,
        currency: args.currency,
        placeName: String(args.place.name ?? "Mesita place"),
        returnUrl: args.returnUrl,
        nowSec: args.nowSec,
      }),
      { idempotencyKey: purchaseId, stripeAccount: args.account.stripe_account_id },
    );
  } catch (err) {
    const code = err instanceof StripeError ? err.code || err.type || "stripe_error" : "stripe_unreachable";
    console.error("[vouchers] checkout_failed", JSON.stringify({ purchase_id: purchaseId, code, message: err instanceof Error ? err.message : String(err) }));
    await admin.from("wallet_purchases")
      .update({ status: "failed", stripe_error: code, updated_at: new Date().toISOString() })
      .eq("id", purchaseId).eq("status", "opening");
    return { ok: false, status: 502, code: "checkout_failed", error: `Stripe refused the checkout: ${code}` };
  }

  const sessionId = String(session.id ?? "");
  const url = String(session.url ?? "");
  const { error: openErr } = await admin.from("wallet_purchases")
    .update({ status: "open", stripe_checkout_session_id: sessionId, updated_at: new Date().toISOString() })
    .eq("id", purchaseId).eq("status", "opening");
  if (openErr) {
    // The session exists but the row cannot name it: nobody could credit it,
    // so it is closed on Stripe and the guest is asked again.
    console.error("[vouchers] session_write", JSON.stringify({ purchase_id: purchaseId, error: openErr.message }));
    try {
      await stripe("POST", `checkout/sessions/${encodeURIComponent(sessionId)}/expire`, undefined, { stripeAccount: args.account.stripe_account_id });
    } catch (err) {
      console.error("[vouchers] expire_failed", JSON.stringify({ purchase_id: purchaseId, error: String(err) }));
    }
    await admin.from("wallet_purchases")
      .update({ status: "failed", stripe_error: "session_write", updated_at: new Date().toISOString() })
      .eq("id", purchaseId).eq("status", "opening");
    return { ok: false, status: 502, code: "checkout_failed", error: "Couldn't open checkout. Try again." };
  }
  return { ok: true, url, purchase_id: purchaseId };
}

/** The same request_id again: the row it made, and its open session if any.
 *  A second Welcome buy while the first one's Checkout is open (another
 *  request_id, the once-per-guest index refused it) answers in_progress
 *  with that session's url, never a 500 (MESITA-3305 rule 16). */
async function resumeRequest(
  admin: SupabaseClient,
  stripe: StripeCall,
  args: { consumerId: string; requestId: string; account: AccountRow; place: VoucherPlace; voucher: MoneyVoucherKey },
): Promise<BuyOk | BuyRefusal> {
  const { data, error } = await admin.from("wallet_purchases")
    .select("id, status, stripe_checkout_session_id")
    .eq("consumer_id", args.consumerId).eq("request_id", args.requestId)
    .maybeSingle();
  if (error) throw new Error(`purchase_read: ${error.message}`);
  let row = data as PurchaseRow | null;
  let inProgress = false;
  if (!row && args.voucher === "voucher_welcome") {
    const { data: w, error: wErr } = await admin.from("wallet_purchases")
      .select("id, status, stripe_checkout_session_id")
      .eq("consumer_id", args.consumerId).eq("place_id", args.place.id)
      .eq("voucher", "voucher_welcome").in("status", ["opening", "open"])
      .maybeSingle();
    if (wErr) throw new Error(`welcome_read: ${wErr.message}`);
    row = (w as PurchaseRow | null) ?? null;
    inProgress = row !== null;
    if (!row) return { ok: false, status: 409, ...REFUSAL_FOR.used };
  }
  if (row && row.status === "open" && row.stripe_checkout_session_id) {
    const session = await stripe("GET", `checkout/sessions/${encodeURIComponent(row.stripe_checkout_session_id)}`, undefined, {
      stripeAccount: args.account.stripe_account_id,
    });
    if (session.status === "open" && typeof session.url === "string") {
      if (inProgress) return { ok: false, status: 409, code: "in_progress", error: "Your Welcome voucher's checkout is still open", url: session.url };
      return { ok: true, url: session.url, purchase_id: row.id };
    }
  }
  if (inProgress) return { ok: false, status: 409, code: "in_progress", error: "Your Welcome voucher's checkout is still open" };
  return { ok: false, status: 409, code: "checkout_failed", error: "That checkout is no longer open. Start again." };
}

export { MESITA_FEE_BPS_VOUCHER, readVoucherPlace };
export type { VoucherPlace };
