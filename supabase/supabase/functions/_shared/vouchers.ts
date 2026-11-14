// Selling vouchers (MESITA-3303, W1b). What a place offers a guest right now,
// and the one Checkout that buys a voucher on the place's own Stripe Connect
// account: a direct charge with no application fee (charge model d5a,
// MESITA-3461); Mesita's fee is stored on the row and billed to the place apart.
//
// The ledger is W1a's (wallet_purchases, wallet_balance); the gate is
// moneyState; the catalog and the rates are money.ts. Nothing here computes
// a price for the client: the client shows what this answers.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { moneyText } from "./pay.ts";
import { MESITA_FEE_BPS_VOUCHER, MIN_CHARGE_CENTS, MONEY_CURRENCY, VOUCHER_CATALOG, voucherBonusCents, voucherFeeCents, currencyForCountry, voucherPriceCents, toStripeAmount } from "./money.ts";
import type { MoneyCode } from "./money-codes.ts";
import { MONEY_VOUCHER_KEYS, type MoneyVoucherKey, moneyState, STORY_MIN_FOLLOWERS, type VoucherReason } from "./money-state.ts";
import { type AccountRow, type PaymentSettings, readAccount, readSettings } from "./payments.ts";
import { readMoneyConfig } from "./money-config.ts";
import { readInstagramSyncState, readVipStanding } from "./consumer-doc.ts";
import { readVoucherPlace, type VoucherPlace, WALLET_CHECKOUT_TTL_SEC } from "./wallet.ts";
import { PER_VISIT_VOUCHERS, type PerVisitVoucher, perVisitSpent, readVisitCount } from "./visits.ts";
import { type StripeCall, StripeError } from "./stripe.ts";
import { errorMessage } from "./errors.ts";

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
   *  Payments Cashback). Never on the tip. */
  card_cashback_bps: number;
  cash_cashback_bps: number;
  /** MESITA-3827: the credit part (Credits Payments Cashback) and a voucher's
   *  price (Mesita Prepayments Cashback), 0 = Off or not usable. */
  credit_cashback_bps: number;
  prepay_cashback_bps: number;
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

/** The catalog in one currency (MESITA-3914); a currency without voucher
 *  prices gets the pesos' lines, and buyRefusal refuses every buy there. */
export function catalogLines(currency: string = MONEY_CURRENCY): Record<MoneyVoucherKey, VoucherCatalogLine> {
  const cur = voucherPriceCents("voucher_200", currency) === null ? MONEY_CURRENCY : currency;
  return Object.fromEntries(
    MONEY_VOUCHER_KEYS.map((k) => {
      const price = voucherPriceCents(k, cur) ?? 0;
      return [k, {
        price_cents: price,
        bonus_cents: voucherBonusCents(k, cur),
        credit_cents: price + voucherBonusCents(k, cur),
        available_after_sec: VOUCHER_CATALOG[k].available_after_sec,
      }];
    }),
  ) as Record<MoneyVoucherKey, VoucherCatalogLine>;
}

/** The pesos' catalog (the default currency). */
export const CATALOG_LINES = catalogLines(MONEY_CURRENCY);

/** The connected account's currency, from its country: Stripe's default
 *  currency is not stored, and a MX account settles in pesos. */
export function accountCurrency(account: AccountRow | null): string | null {
  return currencyForCountry(account?.account_country);
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
    credit_cashback_bps: state.credit_cashback_bps,
    prepay_cashback_bps: state.prepay_cashback_bps,
    house_credits: state.house_credits,
    cash: state.cash,
    mesita_pay: state.mesita_pay,
    vouchers,
    sell,
    unavailable,
    catalog: catalogLines(i.currency),
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

/** Welcome is once per guest per place, at any visit (MESITA-3854, Pato: "if
 *  you forget to use the Welcome, you are fucked"): only a Welcome purchase
 *  that is not expired or failed spends it; a paid bill here no longer does.
 *  wallet_purchases_welcome_once_idx enforces the same rule where buys race. */
export async function readWelcomeUsed(admin: SupabaseClient, consumerId: string | null, placeId: string): Promise<boolean> {
  if (!consumerId) return false;
  const { data, error } = await admin.from("wallet_purchases").select("id").eq("consumer_id", consumerId).eq("place_id", placeId)
    .eq("voucher", "voucher_welcome").not("status", "in", "(expired,failed)").limit(1);
  if (error) throw new Error(`wallet_purchases: ${error.message}`);
  return (data ?? []).length > 0;
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
  if (voucherPriceCents(voucher, offer.currency) === null) {
    return { ok: false, status: 409, code: "currency_mismatch", error: "Vouchers aren't sold in this place's currency" };
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
  if (catalogLines(offer.currency)[voucher].price_cents < min) {
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
  const line = catalogLines(args.currency)[args.voucher];
  const origin = new URL(args.returnUrl).origin;
  const metadata = voucherMetadata(args);
  return {
    mode: "payment",
    client_reference_id: args.purchaseId,
    ...(args.email ? { customer_email: args.email } : {}),
    // Back on the place's own House Card, /wallet/<placeId> (MESITA-3617),
    // never the Wallet's rails: the guest bought credit at one place.
    success_url: `${origin}/wallet/${args.placeId}?prepay={CHECKOUT_SESSION_ID}`,
    cancel_url: args.returnUrl,
    expires_at: args.nowSec + WALLET_CHECKOUT_TTL_SEC,
    metadata,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: args.currency,
        unit_amount: toStripeAmount(line.price_cents, args.currency),
        product_data: {
          name: `${voucherName(args.voucher, args.currency)} · ${args.placeName}`.slice(0, 250),
          description: `${moneyText(line.credit_cents, args.currency)} of credit at ${args.placeName}`.slice(0, 250),
        },
      },
    }],
    payment_intent_data: { metadata },
  };
}

/** What a voucher's Stripe object carries, the Checkout's and the saved
 *  card's PaymentIntent alike (MESITA-3552): the receiver reads
 *  mesita_kind and purchase_id. */
export function voucherMetadata(args: {
  purchaseId: string;
  placeId: string;
  consumerId: string;
  voucher: MoneyVoucherKey;
  /** A basket's other units (MESITA-3841): the amounts become the sums,
   *  `basket` the unit count, `basket_items` what is in it. */
  followers?: readonly MoneyVoucherKey[];
  /** The place's currency (MESITA-3914); pesos when left out. */
  currency?: string;
}): Record<string, string> {
  const units = [args.voucher, ...(args.followers ?? [])];
  const lines = catalogLines(args.currency);
  const meta: Record<string, string> = {
    mesita_kind: "wallet_voucher",
    purchase_id: args.purchaseId,
    place_id: args.placeId,
    consumer_id: args.consumerId,
    voucher: args.voucher,
    amount_cents: String(units.reduce((sum, k) => sum + lines[k].price_cents, 0)),
    bonus_cents: String(units.reduce((sum, k) => sum + lines[k].bonus_cents, 0)),
  };
  if (units.length > 1) {
    meta.basket = String(units.length);
    meta.basket_items = basketItems(units).map((i) => `${i.voucher}x${i.qty}`).join(",").slice(0, 500);
  }
  return meta;
}

// ── The basket (MESITA-3841) ───────────────────────────────────────────────

/** One line of a basket as the client sends it. */
export type BasketItem = { voucher: MoneyVoucherKey; qty: number };

/** At most this many of one voucher in a basket (Small and Big). */
export const BASKET_MAX_QTY = 5;
/** Once per guest per place (Welcome) or one each visit (VIP): one unit. */
export const BASKET_ONE_ONLY: ReadonlySet<MoneyVoucherKey> = new Set(["voucher_welcome", "voucher_vip", "voucher_story"]);

/** The request's basket: `items: [{voucher, qty}]`, or the old one-voucher
 *  `voucher` as a basket of one. Known keys, whole qty 1..5, Welcome / VIP /
 *  Story at most 1, no key twice. Pure. */
export function parseBasket(body: { items?: unknown; voucher?: unknown }): { ok: true; items: BasketItem[] } | { ok: false; error: string } {
  const isKey = (v: unknown): v is MoneyVoucherKey => typeof v === "string" && (MONEY_VOUCHER_KEYS as readonly string[]).includes(v);
  if (body.items === undefined || body.items === null) {
    if (!isKey(body.voucher)) return { ok: false, error: "voucher must be one of the catalog's keys" };
    return { ok: true, items: [{ voucher: body.voucher, qty: 1 }] };
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MONEY_VOUCHER_KEYS.length) {
    return { ok: false, error: "items must list one to six vouchers" };
  }
  const seen = new Set<string>();
  const items: BasketItem[] = [];
  for (const raw of body.items) {
    const it = (raw ?? {}) as Record<string, unknown>;
    if (!isKey(it.voucher)) return { ok: false, error: "each item's voucher must be one of the catalog's keys" };
    if (seen.has(it.voucher)) return { ok: false, error: "each voucher appears once; use qty" };
    seen.add(it.voucher);
    const max = BASKET_ONE_ONLY.has(it.voucher) ? 1 : BASKET_MAX_QTY;
    if (typeof it.qty !== "number" || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > max) {
      return { ok: false, error: `qty must be a whole number from 1 to ${max}` };
    }
    items.push({ voucher: it.voucher, qty: it.qty });
  }
  return { ok: true, items };
}

/** Catalog order, Welcome first: the lead is the first unit, so Welcome's
 *  once-per-guest index answers on the lead's write exactly as a one-voucher
 *  buy does. */
const BASKET_ORDER: readonly MoneyVoucherKey[] = ["voucher_welcome", "voucher_vip", "voucher_story", "voucher_200", "voucher_1000", "voucher_5000"];

/** The basket as voucher units, one per row to write: the lead first. Pure. */
export function basketUnits(items: readonly BasketItem[]): MoneyVoucherKey[] {
  const sorted = [...items].sort((a, b) => BASKET_ORDER.indexOf(a.voucher) - BASKET_ORDER.indexOf(b.voucher));
  return sorted.flatMap((i) => Array.from({ length: i.qty }, () => i.voucher));
}

/** Units back to lines, in the basket's order. Pure. */
export function basketItems(units: readonly MoneyVoucherKey[]): BasketItem[] {
  const out: BasketItem[] = [];
  for (const k of units) {
    const last = out.find((i) => i.voucher === k);
    if (last) last.qty += 1;
    else out.push({ voucher: k, qty: 1 });
  }
  return out;
}

/** The same basket? Compares units as multisets. Pure. */
export function sameUnits(a: readonly (string | null)[], b: readonly (string | null)[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].map(String).sort();
  const y = [...b].map(String).sort();
  return x.every((v, i) => v === y[i]);
}

/** "$100.00MX voucher" / "$10.00 voucher" for the open ones, in the
 *  place's currency (MESITA-3914); the earned ones by name. */
export function voucherName(k: MoneyVoucherKey, currency: string = MONEY_CURRENCY): string {
  switch (k) {
    case "voucher_200":
    case "voucher_1000":
    case "voucher_5000":
      return `${moneyText(catalogLines(currency)[k].price_cents, currency)} voucher`;
    case "voucher_welcome": return "Welcome voucher";
    case "voucher_story": return "Story voucher";
    case "voucher_vip": return "VIP voucher";
  }
}

export type PurchaseRow = { id: string; status: string; stripe_checkout_session_id: string | null };

/** Would this buy push the place past its Credits Limit (MESITA-3947)? Pure.
 *  `limitCents` is place_credit_limit: the place's own limit, else its
 *  currency's default (Admin › Payments › Credits Limit). It binds in both
 *  universes; it replaced the MX$20,000 test-mode cap of MESITA-3305. A
 *  null limit (no default for the currency) refuses: fail closed. A basket
 *  (MESITA-3841) counts every unit's credit, bonus included. */
export function overCreditLimit(
  outstandingCents: number,
  voucher: MoneyVoucherKey | readonly MoneyVoucherKey[],
  limitCents: number | null,
  currency: string = MONEY_CURRENCY,
): boolean {
  if (limitCents === null) return true;
  const keys: readonly MoneyVoucherKey[] = typeof voucher === "string" ? [voucher] : voucher;
  const lines = catalogLines(currency);
  return outstandingCents + keys.reduce((sum, k) => sum + lines[k].credit_cents, 0) > limitCents;
}

/** The place's Credits Limit in cents, null when neither its own nor its
 *  currency's default exists. */
export async function readPlaceCreditLimit(admin: SupabaseClient, placeId: string): Promise<number | null> {
  const { data, error } = await admin.rpc("place_credit_limit", { p_place_id: placeId });
  if (error) throw new Error(`place_credit_limit: ${error.message}`);
  return data === null || data === undefined ? null : Number(data);
}

/** The place's outstanding credit, Available plus Pending, every guest. */
export async function readPlaceOutstanding(admin: SupabaseClient, placeId: string, currency: string, livemode: boolean): Promise<number> {
  const { data, error } = await admin.rpc("wallet_place_outstanding", { p_place_id: placeId, p_currency: currency, p_livemode: livemode });
  if (error) throw new Error(`wallet_place_outstanding: ${error.message}`);
  return typeof data === "number" ? data : Number(data ?? 0);
}

/** The Credits Limit, then one `opening` row under the guest's request_id; the
 *  Checkout path and the saved-card path (MESITA-3552) both start here.
 *  `duplicate`: the request_id (or Welcome's once-per-guest index) already
 *  has a row; the caller resumes it.
 *
 *  A basket (MESITA-3841): `followers` are the other voucher units, one row
 *  each, written right after the lead with basket_lead_id and no
 *  request_id (a retry finds them by the lead). The limit counts them all. A
 *  follower the database refuses fails the lead too: all or nothing. */
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
    followers?: readonly MoneyVoucherKey[];
  },
): Promise<{ ok: true; duplicate: false; purchaseId: string } | { ok: true; duplicate: true } | BuyRefusal> {
  const lines = catalogLines(args.currency);
  const line = lines[args.voucher];
  const followers = args.followers ?? [];
  // The Credits Limit (MESITA-3947): read once, no lock. Two taps at
  // once can each pass it by one basket; the limit is a safety margin, not
  // an exact ceiling.
  const [outstanding, limit] = await Promise.all([
    readPlaceOutstanding(admin, args.place.id, args.currency, args.livemode),
    readPlaceCreditLimit(admin, args.place.id),
  ]);
  if (overCreditLimit(outstanding, [args.voucher, ...followers], limit, args.currency)) {
    return { ok: false, status: 409, code: "place_cap", error: "This place can't take more credit for now. Try again later." };
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
      application_fee_cents: voucherFeeCents(args.voucher, args.currency),
      request_id: args.requestId,
    })
    .select("id")
    .single();
  if (insertErr) {
    if (insertErr.code === "23505") return { ok: true, duplicate: true };
    throw new Error(`purchase_insert: ${insertErr.message}`);
  }
  const purchaseId = String((row as { id: string }).id);
  if (followers.length > 0) {
    const { error: followErr } = await admin.from("wallet_purchases").insert(followers.map((k) => ({
      consumer_id: args.consumerId,
      place_id: args.place.id,
      amount_cents: lines[k].price_cents,
      currency: args.currency,
      status: "opening",
      livemode: args.livemode,
      stripe_account_id: args.account.stripe_account_id,
      voucher: k,
      bonus_cents: lines[k].bonus_cents,
      application_fee_cents: voucherFeeCents(k, args.currency),
      basket_lead_id: purchaseId,
    })));
    if (followErr) {
      console.error("[vouchers] basket_write", JSON.stringify({ purchase_id: purchaseId, code: followErr.code, error: followErr.message }));
      await admin.from("wallet_purchases")
        .update({ status: "failed", stripe_error: "basket_write", updated_at: new Date().toISOString() })
        .eq("id", purchaseId).eq("status", "opening");
      // Welcome's once-per-guest index (another tap bought it meanwhile).
      if (followErr.code === "23505") return { ok: false, status: 409, ...REFUSAL_FOR.used };
      throw new Error(`basket_insert: ${followErr.message}`);
    }
  }
  return { ok: true, duplicate: false, purchaseId };
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
    console.error("[vouchers] checkout_failed", JSON.stringify({ purchase_id: purchaseId, code, message: errorMessage(err) }));
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
