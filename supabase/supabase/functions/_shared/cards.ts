// Saved cards (MESITA-3523): the Wallet's Money rail lists the guest's cards
// and leads with Add.
//
// The card lives on Mesita's own Stripe account, on the guest's one platform
// customer (premier_customers, one per guest and mode; Premier's renewal
// card sits on the same customer). Charges are direct charges on each
// place's connected account (Docs › Credits, MESITA-3280 answer 6), so a
// card saved here is cloned to a place's account before it pays there; that
// step is its own issue. Add is a SetupIntent the app confirms with Stripe's
// Payment Element inside its own sheet (MESITA-4065: no Stripe page; Mesita
// never sees the number). The list and the remove read Stripe itself: no
// card row is stored in Postgres.
//
// A card a live Premier pledge renews with is "in use": it lists, and
// remove refuses it (the payer changes it on the Premier screen).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { readCustomer } from "./boost.ts";
import { errorMessage } from "./errors.ts";
import { paymentsStripeKey, type StripeCall, StripeError, stripeClient } from "./stripe.ts";

export type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  /** A live Premier pledge renews with it: Remove is refused. */
  in_use: boolean;
};

/** How many cards one guest may save: one (Pato, 2026-11-16, MESITA-4168:
 *  "Card (only can save one)"; three since MESITA-3749). Guests who saved more
 *  before keep them. Loyalty (Credits) Cards have no limit. */
export const MAX_CARDS = 1;
/** How many cards one read lists. More than MAX_CARDS, so a guest who saved
 *  more before the limit (ten, until MESITA-3749) still sees, pays with and
 *  removes every one. */
const LIST_LIMIT = 10;

export function cardOf(pm: Record<string, unknown>, inUse: ReadonlySet<string>): SavedCard | null {
  const id = typeof pm.id === "string" ? pm.id : null;
  const card = (pm.card ?? null) as Record<string, unknown> | null;
  if (!id || !card) return null;
  return {
    id,
    brand: typeof card.brand === "string" ? card.brand : "card",
    last4: typeof card.last4 === "string" ? card.last4 : "",
    exp_month: Number(card.exp_month) || 0,
    exp_year: Number(card.exp_year) || 0,
    in_use: inUse.has(id),
  };
}

/** The guest's cards on their platform customer, newest first (Stripe's
 *  order). A customer Stripe no longer knows reads as no cards. */
export async function listCards(stripe: StripeCall, customer: string, inUse: ReadonlySet<string>): Promise<SavedCard[]> {
  let res: Record<string, unknown>;
  try {
    res = await stripe("GET", `customers/${encodeURIComponent(customer)}/payment_methods`, {
      type: "card",
      limit: LIST_LIMIT,
    });
  } catch (err) {
    if (err instanceof StripeError && err.code === "resource_missing") return [];
    throw err;
  }
  const data = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
  return data.map((pm) => cardOf(pm, inUse)).filter((c): c is SavedCard => c !== null);
}

/** The guest's default way to pay (MESITA-4502 column, read since
 *  MESITA-4526): card, apple_pay or google_pay. Null means never chosen,
 *  which reads as the saved card when one exists. */
export type PayMethod = "card" | "apple_pay" | "google_pay";

/** A stored value as a PayMethod; anything else is null. */
export function payMethodOf(value: unknown): PayMethod | null {
  return value === "card" || value === "apple_pay" || value === "google_pay" ? value : null;
}

/** consumers.pay_method for one guest. A failed read is null (the default
 *  then falls back to the card) and is logged, never thrown. */
export async function readPayMethod(admin: SupabaseClient, consumerId: string): Promise<PayMethod | null> {
  const { data, error } = await admin.from("consumers").select("pay_method").eq("id", consumerId).maybeSingle();
  if (error) {
    console.error("[readPayMethod]", JSON.stringify({ error: error.message }));
    return null;
  }
  return payMethodOf((data as { pay_method?: unknown } | null)?.pay_method);
}

/** Cards a live Premier pledge of this guest renews with (open or ready). */
export async function premierCards(admin: SupabaseClient, consumerId: string): Promise<Set<string>> {
  const { data, error } = await admin
    .from("place_backings")
    .select("stripe_payment_method_id")
    .eq("consumer_id", consumerId)
    .in("status", ["open", "ready"])
    .not("stripe_payment_method_id", "is", null);
  if (error) throw new Error(`premier_cards_read: ${error.message}`);
  return new Set(
    ((data ?? []) as { stripe_payment_method_id: string | null }[])
      .map((r) => r.stripe_payment_method_id)
      .filter((v): v is string => !!v),
  );
}

/** The guest's saved cards for the Wallet's one read (MESITA-3814,
 *  consumer-web-get-wallet `with_cards`): [] with no customer yet, null when
 *  Stripe is off or failed (the Wallet says the cards couldn't load and
 *  still shows the money). Never throws. */
export async function readSavedCards(admin: SupabaseClient, consumerId: string, livemode: boolean): Promise<SavedCard[] | null> {
  try {
    const customer = await readCustomer(admin, consumerId, livemode);
    if (!customer) return [];
    const key = paymentsStripeKey();
    if (!key) return null;
    return await listCards(stripeClient(key), customer, await premierCards(admin, consumerId));
  } catch (err) {
    console.error("[readSavedCards]", JSON.stringify({ error: errorMessage(err) }));
    return null;
  }
}

/** Whether one more card may be saved (MESITA-3749: three). The app checks
 *  this before it asks for a SetupIntent; the add-card EF answers 409
 *  `too_many` from the same rule. */
export function addCardCheck(saved: number): { ok: true } | { ok: false; status: 409; code: "too_many"; max: number; error: string } {
  if (saved >= MAX_CARDS) return { ok: false, status: 409, code: "too_many", max: MAX_CARDS, error: `You can save up to ${MAX_CARDS} cards` };
  return { ok: true };
}

/** The SetupIntent that saves one card on the guest's platform customer
 *  (MESITA-4065). `off_session`: the card is later copied to a place's
 *  account and charged there without the guest present. Cards only. */
export function cardSetupIntentParams(args: { customer: string; consumerId: string }): Record<string, unknown> {
  return {
    customer: args.customer,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { mesita_kind: "wallet_card", consumer_id: args.consumerId },
  };
}

export type RemoveRefusal = { ok: false; status: number; code: "not_found" | "in_use"; error: string };

/** Whether a remove may detach this card: it must be on the caller's own
 *  customer (a payment method id from the browser is never trusted) and no
 *  live Premier pledge may renew with it. */
export function removeCheck(
  pm: Record<string, unknown> | null,
  customer: string | null,
  inUse: ReadonlySet<string>,
): { ok: true } | RemoveRefusal {
  const owner = pm ? (typeof pm.customer === "string" ? pm.customer : (pm.customer as { id?: string } | null)?.id ?? null) : null;
  if (!pm || !customer || owner !== customer) {
    return { ok: false, status: 404, code: "not_found", error: "That card is not saved on your account" };
  }
  if (inUse.has(String(pm.id))) {
    return { ok: false, status: 409, code: "in_use", error: "This card pays your Premier plan. Change it there first." };
  }
  return { ok: true };
}
