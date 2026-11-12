// Saved cards (MESITA-3523): the guest's cards on Mesita's Stripe account,
// listed on the Wallet's Money rail. Add opens Stripe's own page in setup
// mode (Mesita never sees the number); Remove detaches one. Every refusal is
// the server's.

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

/** How many cards a guest may save (MESITA-3749). The server's rule
 *  (consumer-web-add-card answers too_many); here it only hides Add. */
export const MAX_SAVED_CARDS = 3;

/** The query param Stripe's return carries (`?card=<session>`). */
export const CARD_RETURN_PARAM = "card";

export async function apiListCards(client: SupabaseClient): Promise<{ cards: SavedCard[]; test_mode: boolean }> {
  const r = await invokeEF<{ cards: SavedCard[]; test_mode: boolean }>(client, "consumer-web-list-cards", {});
  return { cards: Array.isArray(r.cards) ? r.cards : [], test_mode: r.test_mode === true };
}

/** Opens Stripe's page to save one card; answers its url. */
export async function apiAddCard(client: SupabaseClient, returnUrl: string): Promise<{ url: string }> {
  return await invokeEF<{ url: string }>(client, "consumer-web-add-card", { return_url: returnUrl });
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
  too_many: "You can save up to three cards. Remove one first.",
  in_use: "This card pays your Premier plan. Change it there first.",
  not_found: "That card is already gone.",
  checkout_failed: "Couldn't open the card page. Try again.",
  remove_failed: "Couldn't remove the card. Try again.",
};
