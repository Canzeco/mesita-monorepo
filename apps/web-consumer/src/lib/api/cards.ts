// Saved cards (MESITA-3523): the guest's cards on Mesita's Stripe account,
// listed on the Wallet's Money rail. Add is the app's own card sheet with
// Stripe's Payment Element inside (MESITA-4065: no Stripe page; Mesita never
// sees the number); Remove detaches one. Every refusal is the server's.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type SavedCard = {
  id: string;
  /** Stripe's brand key: visa, mastercard, amex, … */
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  /** A Premier plan renews with it: Remove is refused. */
  in_use: boolean;
};

/** How many cards a guest may save: one (MESITA-4168). The server's rule
 *  (consumer-web-add-card answers too_many); here it only hides Add. */
export const MAX_SAVED_CARDS = 1;

export async function apiListCards(client: SupabaseClient): Promise<{ cards: SavedCard[]; test_mode: boolean }> {
  const r = await invokeEF<{ cards: SavedCard[]; test_mode: boolean }>(client, "consumer-web-list-cards", {});
  return { cards: Array.isArray(r.cards) ? r.cards : [], test_mode: r.test_mode === true };
}

/** A SetupIntent for one new card (MESITA-4065): the sheet confirms it with
 *  Stripe's Payment Element. Refusals arrive as EFError with a code from
 *  CARD_REFUSAL (too_many, setup_failed, payments_unavailable, update_app). */
export async function apiStartCardSetup(
  client: SupabaseClient,
): Promise<{ client_secret: string; publishable_key: string; setup_intent_id: string; test_mode: boolean }> {
  return await invokeEF<{ client_secret: string; publishable_key: string; setup_intent_id: string; test_mode: boolean }>(
    client,
    "consumer-web-add-card",
    {},
  );
}

/** Whether a card is past its expiry month (MESITA-4065: never picked by
 *  default, never payable). */
export function isExpired(c: Pick<SavedCard, "exp_month" | "exp_year">, now: Date = new Date()): boolean {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return c.exp_year < y || (c.exp_year === y && c.exp_month < m);
}

export async function apiRemoveCard(client: SupabaseClient, paymentMethodId: string): Promise<void> {
  await invokeEF<Record<string, never>>(client, "consumer-web-remove-card", { payment_method_id: paymentMethodId });
}

const BRAND: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
  carnet: "Carnet",
};

export function brandLabel(brand: string): string {
  return BRAND[brand] ?? (brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : "Card");
}

/** "08/29" */
export function expiryLabel(c: Pick<SavedCard, "exp_month" | "exp_year">): string {
  return `${String(c.exp_month).padStart(2, "0")}/${String(c.exp_year % 100).padStart(2, "0")}`;
}

export const CARD_REFUSAL: Record<string, string> = {
  sign_in: "Sign in to save a card.",
  too_many: "You already have a card. Remove it in Wallet to add another.",
  in_use: "This card pays your Premier plan. Change it there first.",
  not_found: "That card is already gone.",
  setup_failed: "Couldn't open the card form. Try again.",
  payments_unavailable: "Cards aren't available right now.",
  update_app: "Reload Mesita to add a card.",
  remove_failed: "Couldn't remove the card. Try again.",
};
