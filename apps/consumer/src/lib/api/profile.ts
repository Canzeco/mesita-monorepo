// Frontend API surface for the consumer-facing profile + cashback EFs.
//
// Pre-entity-split this file used to also house the ticket workflow /
// taxonomy code under the name `api/tickets.ts`. After the split
// (reservations + coupons each got their own EFs) the ticket helpers
// were dropped and the file was renamed to its current responsibility:
// fetch + update the consumer profile, plus the currency display
// helper that every wallet surface reuses.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

// ─── Consumer profile ───────────────────────────────────────────────────────

export type ConsumerProfile = {
  id: string;
  code: string;
  // Legacy concat of first + last. EFs keep it populated on every write
  // so older readers (find-consumer search, ticket meta) keep working.
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  sex: string | null;
  birthday: string | null;
  country: string | null;
  phone: string | null;
  cashback_balance_cents: number;
};

type ConsumerOnboardingInput = {
  first_name: string;
  last_name: string;
  sex: "male" | "female" | "other";
  birthday: string; // YYYY-MM-DD
  country: string;
  // Optional — phone is the auth identity and lives on auth.user.phone.
  // consumer-update-profile mirrors it into consumers.phone on first call.
  phone?: string;
};

export async function apiUpdateConsumerProfile(
  client: SupabaseClient,
  input: ConsumerOnboardingInput,
): Promise<ConsumerProfile> {
  const { consumer } = await invokeEF<{ consumer: ConsumerProfile }>(
    client,
    "consumer-update-profile",
    input,
  );
  return consumer;
}

export async function apiFetchConsumerProfile(
  client: SupabaseClient,
): Promise<ConsumerProfile> {
  const { consumer } = await invokeEF<{ consumer: ConsumerProfile }>(
    client,
    "consumer-get-profile",
    {},
  );
  return consumer;
}

// ─── Display helpers ─────────────────────────────────────────────────────

export function formatCurrency(
  cents: number | null | undefined,
  currency = "MXN",
): string {
  if (cents == null) return "—";
  const value = cents / 100;
  try {
    // Intl with `en-US` + `MXN` yields the unambiguous "MX$1,234" prefix
    // (Mexican-locale formatting would collapse to just "$1,234", which
    // reads as USD outside Mexico). Other ISO codes still format with
    // their conventional prefix ("$", "€", etc.).
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency === "MXN" ? "MX$" : "$"}${value.toFixed(0)}`;
  }
}
