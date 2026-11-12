// Saved cards (MESITA-3523): the Wallet's Money rail lists the guest's cards
// and leads with Add.
//
// The card lives on Mesita's own Stripe account, on the guest's one platform
// customer (premier_customers, one per guest and mode; Premier's renewal
// card sits on the same customer). Charges are direct charges on each
// place's connected account (Docs › Credits, MESITA-3280 answer 6), so a
// card saved here is cloned to a place's account before it pays there; that
// step is its own issue. Add is a Stripe Checkout in `setup` mode (Stripe's
// page types the card; Mesita never sees the number). The list and the
// remove read Stripe itself: no card row is stored in Postgres.
//
// A card a live Premier pledge renews with is "in use": it lists, and
// remove refuses it (the payer changes it on the Premier screen).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { CHECKOUT_TTL_SEC } from "./boost.ts";
import { type StripeCall, StripeError } from "./stripe.ts";

export type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  /** A live Premier pledge renews with it: Remove is refused. */
  in_use: boolean;
};

/** How many cards one guest may save: three (Pato, MESITA-3749: "max to add
 *  three money cards"). Credits Cards have no limit. */
export const MAX_CARDS = 3;
/** How many cards one read lists. More than MAX_CARDS, so a guest who saved
 *  more before the limit (ten, until MESITA-3749) still sees, pays with and
 *  removes every one. */
const LIST_LIMIT = 10;

/** The query param the Checkout's return carries. */
export const CARD_RETURN_PARAM = "card";

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

/** The Checkout that saves one card on the guest's platform customer. The
 *  return carries `?card=<session id>` so the page says what happened. */
export function cardSetupParams(args: {
  customer: string;
  consumerId: string;
  returnUrl: string;
  nowSec: number;
}): Record<string, unknown> {
  const sep = args.returnUrl.includes("?") ? "&" : "?";
  const metadata = { mesita_kind: "wallet_card", consumer_id: args.consumerId };
  return {
    mode: "setup",
    customer: args.customer,
    payment_method_types: ["card"],
    client_reference_id: args.consumerId,
    success_url: `${args.returnUrl}${sep}${CARD_RETURN_PARAM}={CHECKOUT_SESSION_ID}`,
    cancel_url: args.returnUrl,
    expires_at: args.nowSec + CHECKOUT_TTL_SEC,
    metadata,
    setup_intent_data: { metadata },
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
