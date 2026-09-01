// Frontend API surface for saved payment methods.
//
// "Cards, never wallet" held while cards and Credits were two sibling sheets
// in Me › More (Pato, 2026-08-29). Superseded 2026-08-31: there is now one
// Wallet — the Activity tab's first section — and these cards are a row
// inside it, alongside Credits and Gift. Card is still the right word for the
// INSTRUMENT; it just is not the container any more. Nothing here caches: every call goes
// to Stripe through its EF, so a card removed anywhere is gone everywhere on
// the next list.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type ConsumerCard = {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
};

export type ConsumerCardList = {
  cards: ConsumerCard[];
  /** No Stripe secret, or MOCK_CARDS=true. The sheet says so out loud. */
  mock: boolean;
};

export async function apiListCards(
  client: SupabaseClient,
): Promise<ConsumerCardList> {
  const res = await invokeEF<{ cards: ConsumerCard[]; mock?: boolean }>(
    client,
    "consumer-web-list-cards",
    {},
    "Couldn't load your cards.",
  );
  return { cards: res.cards ?? [], mock: res.mock === true };
}

/** Returns the Stripe-hosted setup URL to send the guest to. */
export async function apiAddCard(
  client: SupabaseClient,
): Promise<{ setupUrl: string; mock: boolean }> {
  const res = await invokeEF<{ setup_url: string; mock?: boolean }>(
    client,
    "consumer-web-add-card",
    {},
    "Couldn't start adding a card.",
  );
  return { setupUrl: res.setup_url, mock: res.mock === true };
}

export async function apiRemoveCard(
  client: SupabaseClient,
  paymentMethodId: string,
): Promise<void> {
  await invokeEF(
    client,
    "consumer-web-remove-card",
    { paymentMethodId },
    "Couldn't remove that card.",
  );
}

export async function apiSetDefaultCard(
  client: SupabaseClient,
  paymentMethodId: string,
): Promise<void> {
  await invokeEF(
    client,
    "consumer-web-set-default-card",
    { paymentMethodId },
    "Couldn't make that your default card.",
  );
}

/** "Visa ···· 4242" — brand casing is Stripe's (`visa`, `amex`, …). */
export function formatCardLabel(card: ConsumerCard): string {
  const brand = card.brand
    ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
    : "Card";
  return card.last4 ? `${brand} ···· ${card.last4}` : brand;
}

/** A card is expired once its expiry month is fully behind us. */
export function isCardExpired(
  card: ConsumerCard,
  now: Date = new Date(),
): boolean {
  if (!card.exp_year || !card.exp_month) return false;
  const endOfExpiryMonth = new Date(card.exp_year, card.exp_month, 1);
  return now >= endOfExpiryMonth;
}

export function formatCardExpiry(card: ConsumerCard): string | null {
  if (!card.exp_year || !card.exp_month) return null;
  return `${String(card.exp_month).padStart(2, "0")}/${String(
    card.exp_year,
  ).slice(-2)}`;
}
