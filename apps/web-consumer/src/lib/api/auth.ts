// Frontend API surface for the consumer sign-in EF.
//
// Same constraint as every other api/*.ts module here: each helper wraps
// exactly one Edge Function — no composition, no chaining. The sign-in
// EF is the post-Auth housekeeping step: it reads the freshly-issued
// JWT, stamps app_metadata.role, lazy-creates the consumer profile row,
// and returns what the caller needs to route (role + onboarded boolean).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

type AppRole = "consumer" | "staff" | "business" | "admin";

type ConsumerSigninResult = {
  role: AppRole;
  consumer: {
    id: string;
    code: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  onboarded: boolean;
};

export async function apiConsumerSigninPhone(
  client: SupabaseClient,
): Promise<ConsumerSigninResult> {
  return invokeEF<ConsumerSigninResult>(
    client,
    "consumer-web-signin-phone",
    {},
  );
}

/** The Pay QR door (MESITA-3526): the name of the place a table QR points
 *  at, for the sign-in title. Name only; null for an unknown or hidden
 *  place. No session needed. */
export async function apiGetPayPlaceName(
  client: SupabaseClient,
  placeId: string,
): Promise<string | null> {
  const res = await invokeEF<{ name: string | null }>(
    client,
    "consumer-web-get-pay-place-name",
    { place_id: placeId },
  );
  return res.name;
}

export type GiftPreview = {
  amount_cents: number;
  currency: string;
  placeName: string | null;
};

/** A friend's gift link before sign-in (MESITA-4229): an open link's amount
 *  and place, for the sign-in title and its link card. Null for anything
 *  else: a link someone took, one taken back, an unknown key, an error, or
 *  no answer within `timeoutMs`, so a slow read never holds the sign-in
 *  page. No session needed. */
export async function apiGetGiftPreview(
  client: SupabaseClient,
  token: string,
  timeoutMs = 1500,
): Promise<GiftPreview | null> {
  const read = invokeEF<{
    gift: { amount_cents: number; currency: string; place: { name: string } | null };
  }>(client, "consumer-web-get-gift-preview", { token }).then(
    (res) => ({
      amount_cents: res.gift.amount_cents,
      currency: res.gift.currency,
      placeName: res.gift.place?.name ?? null,
    }),
    () => null,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([read, late]);
  } finally {
    clearTimeout(timer);
  }
}
