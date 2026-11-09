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

/** "Call me with the code" (MESITA-3470): marks `phone` (E.164) so the
 *  code Auth sends next comes by call, not text. Call it right before
 *  signInWithOtp. No session needed. */
export async function apiCallSignInCode(
  client: SupabaseClient,
  phone: string,
): Promise<void> {
  await invokeEF<Record<string, never>>(
    client,
    "consumer-web-call-sign-in-code",
    { phone },
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
