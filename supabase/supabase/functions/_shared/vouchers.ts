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
import { MESITA_FEE_BPS_VOUCHER, MIN_CHARGE_CENTS, MONEY_CURRENCY, VOUCHER_CATALOG, voucherBonusCents, voucherFeeCents, currencyForCountry, voucherPriceCents } from "./money.ts";
import type { MoneyCode } from "./money-codes.ts";
import { MONEY_VOUCHER_KEYS, type MoneyVoucherKey, moneyState, STORY_MIN_FOLLOWERS, type VoucherReason } from "./money-state.ts";
import { type AccountRow, type PaymentSettings, readAccount, readSettings } from "./payments.ts";
import { readMoneyConfig } from "./money-config.ts";
import { readInstagramSyncState } from "./consumer-doc.ts";
import { readStoryRules, storyMode, type StoryMode } from "./story-mention.ts";
import { instagramHandleOfUrl } from "./place-instagram.ts";
import { readVoucherPlace, type VoucherPlace } from "./wallet.ts";
import { PER_VISIT_VOUCHERS, type PerVisitVoucher, perVisitSpent, readVisitCount, VISIT_STATUSES } from "./visits.ts";
import { type StoryRecord, storyFreesSlot } from "./story.ts";

export type PlaceBalance = {
  available_cents: number;
  pending_cents: number;
  held_cents: number;
  spendable_cents: number;
  /** When the next pending credit turns spendable (MESITA-4224: the Offers
   *  page's "Pending $X · ready 6:40 pm"); null with nothing pending. */
  next_ready_at: string | null;
};

/** One catalog line as the client shows it: the price, the bonus, and the
 *  credit the guest ends up with (the sum, so no client adds). */
export type VoucherCatalogLine = { price_cents: number; bonus_cents: number; credit_cents: number; available_after_sec: number };

/** What the place screen's Vouchers tab and the buy door read. */
export type VoucherOffer = {
  test_mode: boolean;
  currency: string;
  charges_enabled: boolean;
  /** Loyalty Cards is On here: new credit can be born. Off never stops a
   *  guest spending what they already hold. */
  loyalty_cards: boolean;
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
  /** Story, one each new visit (MESITA-3463): true when this guest
   *  already bought one here for every visit they made. Absent reads false. */
  perVisitUsed?: Partial<Record<PerVisitVoucher, boolean>>;
  /** The place has a place code, so the waiter's charge can open (MESITA-3545). */
  hasPlaceCode?: boolean;
};

/** This guest's own block on one voucher at one place, or null: Welcome
 *  once per place ("used"), Story one each new visit
 *  ("needs_visit"). One rule for the place screen's offer (offerFrom) and
 *  the list rows (guestSell, MESITA-4207). */
export function guestReason(
  k: MoneyVoucherKey,
  g: { welcomeUsed: boolean; perVisitUsed?: Partial<Record<PerVisitVoucher, boolean>> },
): "used" | "needs_visit" | null {
  if (k === "voucher_welcome" && g.welcomeUsed) return "used";
  if (g.perVisitUsed?.[k as PerVisitVoucher]) return "needs_visit";
  return null;
}

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
    else {
      const why = guestReason(k, i);
      if (why) unavailable[k] = why;
      else sell.push(k);
    }
  }
  // The guest's offer carries the voucher switches alone; the Mesita Payments switch
  // (MESITA-3396) is already folded into the mark.
  const vouchers = Object.fromEntries(MONEY_VOUCHER_KEYS.map((k) => [k, i.settings[k] === true])) as Record<MoneyVoucherKey, boolean>;
  return {
    test_mode: !i.livemode,
    currency: i.currency,
    charges_enabled: usable,
    loyalty_cards: state.loyalty_cards,
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
  const row = (Array.isArray(data) ? data[0] : data) as Omit<PlaceBalance, "next_ready_at"> | null | undefined;
  const sums = row ?? { available_cents: 0, pending_cents: 0, held_cents: 0, spendable_cents: 0 };
  // Only a guest with pending credit pays the second read (MESITA-4224).
  if (sums.pending_cents <= 0) return { ...sums, next_ready_at: null };
  const { data: next, error: nextError } = await admin.from("wallet_entries").select("available_at")
    .eq("consumer_id", consumerId).eq("place_id", placeId).eq("currency", currency).eq("livemode", livemode)
    .gt("available_at", new Date().toISOString()).order("available_at", { ascending: true }).limit(1);
  if (nextError) throw new Error(`wallet_entries: ${nextError.message}`);
  const at = (next ?? [])[0] as { available_at: string | null } | undefined;
  return { ...sums, next_ready_at: at?.available_at ?? null };
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

/** The guest's Story purchases among these whose Story frees its visit
 *  slot (MESITA-4405, storyFreesSlot): expired with no story ever bound. */
async function readFreedStoryPurchases(admin: SupabaseClient, consumerId: string, purchaseIds: string[]): Promise<Set<string>> {
  if (purchaseIds.length === 0) return new Set();
  const { data, error } = await admin.from("stories").select("purchase_id, state, void_reason, first_bound_at")
    .eq("consumer_id", consumerId).eq("state", "void").eq("void_reason", "expired").is("first_bound_at", null)
    .in("purchase_id", purchaseIds);
  if (error) throw new Error(`stories: ${error.message}`);
  return new Set(
    ((data ?? []) as Array<Pick<StoryRecord, "purchase_id" | "state" | "void_reason" | "first_bound_at">>)
      .filter((r) => storyFreesSlot(r) && r.purchase_id).map((r) => r.purchase_id!),
  );
}

/** Story, one each new visit (MESITA-3463): each is spent when the
 *  guest's live purchases of it here (not expired or failed) outnumber
 *  their visits here (visits.ts). A Story that expired with no story ever
 *  posted does not count (MESITA-4405). */
export async function readPerVisitUsed(
  admin: SupabaseClient,
  consumerId: string | null,
  placeId: string,
): Promise<Partial<Record<PerVisitVoucher, boolean>>> {
  if (!consumerId) return {};
  const [visits, bought] = await Promise.all([
    readVisitCount(admin, consumerId, placeId),
    admin.from("wallet_purchases").select("id, voucher").eq("consumer_id", consumerId).eq("place_id", placeId)
      .in("voucher", [...PER_VISIT_VOUCHERS]).not("status", "in", "(expired,failed)"),
  ]);
  if (bought.error) throw new Error(`wallet_purchases: ${bought.error.message}`);
  const all = (bought.data ?? []) as Array<{ id: string; voucher: string }>;
  const freed = await readFreedStoryPurchases(admin, consumerId, all.filter((r) => r.voucher === "voucher_story").map((r) => r.id));
  const rows = all.filter((r) => !freed.has(r.id));
  const out: Partial<Record<PerVisitVoucher, boolean>> = {};
  for (const k of PER_VISIT_VOUCHERS) {
    out[k] = perVisitSpent(rows.filter((r) => r.voucher === k).length, visits);
  }
  return out;
}

/** One guest's blocks at one place, as offerFrom reads them. */
export type GuestBlocks = { welcomeUsed: boolean; perVisitUsed: Partial<Record<PerVisitVoucher, boolean>> };

/** The vouchers a place's list row sells, minus this guest's own blocks
 *  (MESITA-4207): Home's and Search's chips agree with the place screen's
 *  Offers. No blocks (anonymous, or a place the guest never bought at)
 *  leaves the place's list as it is. */
export function guestSell(sell: readonly MoneyVoucherKey[], blocks: GuestBlocks | undefined): MoneyVoucherKey[] {
  if (!blocks) return [...sell];
  return sell.filter((k) => guestReason(k, blocks) === null);
}

/** The pure half of readGuestBlocks: the guest's live purchases (not expired
 *  or failed) of Welcome and Story, and their visits (visits.ts), one
 *  row each, grouped by place with readWelcomeUsed's and readPerVisitUsed's
 *  definitions. A place with no purchase row gets no entry (nothing spent).
 *  A purchase marked `freed` (its Story expired with no story ever posted,
 *  MESITA-4405) does not count. */
export function guestBlocksFrom(
  purchases: readonly { place_id: string; voucher: string; freed?: boolean }[],
  visits: readonly { place_id: string }[],
): Map<string, GuestBlocks> {
  const visitCount = new Map<string, number>();
  for (const v of visits) visitCount.set(v.place_id, (visitCount.get(v.place_id) ?? 0) + 1);
  const bought = new Map<string, Map<string, number>>();
  for (const p of purchases) {
    if (p.freed) continue;
    const byVoucher = bought.get(p.place_id) ?? new Map<string, number>();
    byVoucher.set(p.voucher, (byVoucher.get(p.voucher) ?? 0) + 1);
    bought.set(p.place_id, byVoucher);
  }
  const out = new Map<string, GuestBlocks>();
  for (const [placeId, byVoucher] of bought) {
    const visitsHere = visitCount.get(placeId) ?? 0;
    const perVisitUsed: Partial<Record<PerVisitVoucher, boolean>> = {};
    for (const k of PER_VISIT_VOUCHERS) perVisitUsed[k] = perVisitSpent(byVoucher.get(k) ?? 0, visitsHere);
    out.set(placeId, { welcomeUsed: (byVoucher.get("voucher_welcome") ?? 0) > 0, perVisitUsed });
  }
  return out;
}

/** This guest's blocks at every place of a list page (MESITA-4207): two
 *  batched reads for the page, never one per place. Null for an anonymous
 *  caller or an empty page; a failed read is logged and reads null, so the
 *  page keeps the place-level offers rather than fail. */
export async function readGuestBlocks(
  admin: SupabaseClient,
  consumerId: string | null,
  placeIds: readonly string[],
): Promise<Map<string, GuestBlocks> | null> {
  if (!consumerId || placeIds.length === 0) return null;
  const ids = [...new Set(placeIds)];
  const [bought, visits] = await Promise.all([
    admin.from("wallet_purchases").select("id, place_id, voucher").eq("consumer_id", consumerId).in("place_id", ids)
      .in("voucher", ["voucher_welcome", ...PER_VISIT_VOUCHERS]).not("status", "in", "(expired,failed)"),
    admin.from("wallet_payments").select("place_id").eq("consumer_id", consumerId).in("place_id", ids)
      .gt("card_cents", 0).in("status", [...VISIT_STATUSES]),
  ]);
  const error = bought.error ?? visits.error;
  if (error) {
    console.error("[vouchers] guest_blocks_read_failed", JSON.stringify({ message: error.message, places: ids.length }));
    return null;
  }
  const rows = (bought.data ?? []) as { id: string; place_id: string; voucher: string }[];
  let freed: Set<string>;
  try {
    freed = await readFreedStoryPurchases(admin, consumerId, rows.filter((r) => r.voucher === "voucher_story").map((r) => r.id));
  } catch (e) {
    console.error("[vouchers] guest_blocks_read_failed", JSON.stringify({ message: String(e), places: ids.length }));
    return null;
  }
  return guestBlocksFrom(
    rows.map((r) => ({ ...r, freed: freed.has(r.id) })),
    (visits.data ?? []) as { place_id: string }[],
  );
}

/** List rows with `offers.sell` narrowed to what this guest can buy
 *  (MESITA-4207). `vouchers_up_to_pct` and `mesita_pay` stay the place's.
 *  STORY NEEDS THE GUEST'S INSTAGRAM TOO (autoplan eng E2): Story leaves
 *  every row when storyRefusal would refuse this guest at the buy door, so
 *  no chip invites a purchase the guest cannot make. A failed read keeps it. */
export async function withGuestOffers<T extends { id: string; offers: { sell: MoneyVoucherKey[] } }>(
  admin: SupabaseClient | null,
  consumerId: string | null,
  rows: T[],
): Promise<T[]> {
  // NO MENTION SOURCE, NO STORY (MESITA-4264): live payments with Meta off.
  const storyOpen = storyMode() !== "unavailable";
  if (!admin || !consumerId) {
    return storyOpen ? rows : rows.map((r) => ({ ...r, offers: { ...r.offers, sell: r.offers.sell.filter((k) => k !== "voucher_story") } }));
  }
  const [blocks, story] = await Promise.all([
    readGuestBlocks(admin, consumerId, rows.map((r) => r.id)),
    Promise.all([readStoryGuest(admin, consumerId), storyEligibilityContext(admin)]).then(
      ([g, ctx]) => storyRefusal("voucher_story", g, ctx) === null,
      (e) => {
        console.error("[vouchers] story_guest_read_failed", JSON.stringify({ message: String(e) }));
        return true;
      },
    ),
  ]);
  return rows.map((r) => {
    const sell = blocks ? guestSell(r.offers.sell, blocks.get(r.id)) : [...r.offers.sell];
    return { ...r, offers: { ...r.offers, sell: story && storyOpen ? sell : sell.filter((k) => k !== "voucher_story") } };
  });
}

/** EVERY OFFER THE PLACE SELLS (Pato, 2026-11-17, MESITA-4292: "the offers
 *  must be dancing … welcome story prepay (the three classics)"): Home's and
 *  Search's list rows keep the place's own `offers.sell`, whoever looks; only
 *  the place-wide Story gate applies (no mention source, MESITA-4264). The
 *  Offers page and the buy door still refuse what this guest cannot buy, with
 *  the reason. withGuestOffers (MESITA-4207) stays for the Wallet. */
export function withPlaceOffers<T extends { offers: { sell: MoneyVoucherKey[] } }>(rows: T[]): T[] {
  if (storyMode() !== "unavailable") return rows;
  return rows.map((r) => ({ ...r, offers: { ...r.offers, sell: r.offers.sell.filter((k) => k !== "voucher_story") } }));
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
  return withStoryMode(offerFrom({
    settings,
    account,
    livemode,
    currency,
    paused: config.buying_paused,
    balance,
    welcomeUsed,
    perVisitUsed,
    hasPlaceCode: !code.error && !!code.data,
  }), storyMode(), instagramHandleOfUrl(place.instagram_url) !== null);
}

/** Story is sold only while a mention source exists (MESITA-4264): with
 *  live payments and Meta off ('unavailable') it leaves `sell`. NO PLACE
 *  INSTAGRAM, NO STORY (MESITA-4291): the story mentions the place's
 *  Instagram, so a place without one sells none. Absent `placeInstagram`
 *  reads false: a caller that did not read the place sells no Story. */
export function withStoryMode(offer: VoucherOffer, mode: StoryMode, placeInstagram = false): VoucherOffer {
  if ((mode !== "unavailable" && placeInstagram) || !offer.sell.includes("voucher_story")) return offer;
  return {
    ...offer,
    sell: offer.sell.filter((k) => k !== "voucher_story"),
    unavailable: { ...offer.unavailable, voucher_story: "off" },
  };
}

// ── Buying ─────────────────────────────────────────────────────────────────

export type BuyRefusal = { ok: false; status: number; code: MoneyCode; error: string; url?: string };
export type BuyOk = { ok: true; url: string; purchase_id: string };

export const REFUSAL_FOR: Record<VoucherReason, { code: MoneyCode; error: string }> = {
  off: { code: "not_available", error: "This place does not sell that voucher" },
  needs_account: { code: "no_account", error: "This place has not connected payments yet" },
  needs_loyalty_cards: { code: "not_available", error: "This place doesn't accept prepayments" },
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
export type StoryGuest = {
  instagram_handle: string | null;
  instagram_followers_count: number | null;
  /** MESITA-4263: null = not known yet (never synced since); only false is public. */
  instagram_is_private?: boolean | null;
} | null;

/** What Story's guest gate is measured against (MESITA-4425): the live
 *  follower floor and whether emulator mode is in effect. Both REQUIRED on
 *  storyRefusal so a caller that forgets them fails `deno check` instead of
 *  quietly keeping the old floor. */
export type StoryEligibility = {
  /** money_config.story_min_followers (Admin › Configurations › Stories). */
  minFollowers: number;
  /** Emulator mode in effect (MESITA-4426): money_config.story_emulator on
   *  AND payments in test mode AND Meta off (storyMode() === "emulated").
   *  Every guest with a linked Instagram then qualifies. */
  emulator: boolean;
};

/** The floor STORY_MIN_FOLLOWERS and no emulator: what a failed read means. */
export const STORY_ELIGIBILITY_DEFAULT: StoryEligibility = { minFollowers: STORY_MIN_FOLLOWERS, emulator: false };

/** The one place every Story check gets its StoryEligibility. A failed read
 *  is the default floor with no emulator, never an open door. */
export async function storyEligibilityContext(admin: SupabaseClient): Promise<StoryEligibility> {
  try {
    const rules = await readStoryRules(admin);
    // Never a half-emulator: live payments or a real Meta source turn it off
    // whatever the switch says.
    return { minFollowers: rules.minFollowers, emulator: rules.emulator && storyMode() === "emulated" };
  } catch (e) {
    console.error("[vouchers] story_rules_read_failed", JSON.stringify({ message: String(e) }));
    return STORY_ELIGIBILITY_DEFAULT;
  }
}

/** Story's guest gate (MESITA-3507, MESITA-4425, MESITA-4484): a linked public
 *  Instagram with `ctx.minFollowers` followers OR MORE, emulator or not. The
 *  emulator supplies that account; it does not skip the gate. Null when the
 *  guest may buy it. Any other voucher passes. */
export function storyRefusal(voucher: MoneyVoucherKey, guest: StoryGuest, ctx: StoryEligibility): BuyRefusal | null {
  if (voucher !== "voucher_story") return null;
  if (!guest?.instagram_handle) {
    return { ok: false, status: 409, code: "needs_instagram", error: "Link your Instagram to buy the Story voucher" };
  }
  if ((guest.instagram_followers_count ?? 0) < ctx.minFollowers) {
    return {
      ok: false,
      status: 409,
      code: "few_followers",
      error: `The Story voucher is for Instagram accounts with ${ctx.minFollowers.toLocaleString("en-US")} or more followers`,
    };
  }
  // MESITA-4296: a private account's mentions never reach Mesita (Mesita
  // follows no one), so the story could never be found. Unknown reads private
  // until the next Sync records it (MESITA-4263).
  if (guest.instagram_is_private !== false && guest.instagram_is_private !== undefined) {
    return { ok: false, status: 409, code: "private_account", error: "Make your Instagram public, then sync it in Me" };
  }
  return null;
}

/** The buying guest's Instagram, for storyRefusal, through the consumer door. */
export async function readStoryGuest(admin: SupabaseClient, consumerId: string): Promise<StoryGuest> {
  const res = await readInstagramSyncState(admin, consumerId);
  if (!res.ok) throw new Error(`consumers: ${res.error}`);
  if (res.deleted) return null;
  return { instagram_handle: res.handle, instagram_followers_count: res.followers, instagram_is_private: res.isPrivate };
}

/** What a voucher's Stripe object carries: the saved card's PaymentIntent
 *  (MESITA-3552; the Checkout went with MESITA-4065): the receiver reads
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
/** Once per guest per place (Welcome) or one each visit (Story): one unit. */
export const BASKET_ONE_ONLY: ReadonlySet<MoneyVoucherKey> = new Set(["voucher_welcome", "voucher_story"]);

/** The request's basket: `items: [{voucher, qty}]`, or the old one-voucher
 *  `voucher` as a basket of one. Known keys, whole qty 1..5, Welcome and
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
const BASKET_ORDER: readonly MoneyVoucherKey[] = ["voucher_welcome", "voucher_story", "voucher_200", "voucher_1000", "voucher_5000"];

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
    /** MESITA-4384: card (default) | express, on the lead and every follower. */
    paySource?: "card" | "express";
  },
): Promise<{ ok: true; duplicate: false; purchaseId: string } | { ok: true; duplicate: true } | BuyRefusal> {
  const pay = args.paySource === "express" ? { pay_source: "express", pay_with: "express" } : { pay_source: "card" };
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
      ...pay,
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
      ...pay,
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

export { MESITA_FEE_BPS_VOUCHER, readVoucherPlace };
export type { VoucherPlace };
