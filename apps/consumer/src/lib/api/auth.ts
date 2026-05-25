// Frontend API surface for the consumer sign-in EF.
//
// Same constraint as every other api/*.ts module here: each helper wraps
// exactly one Edge Function — no composition, no chaining. The sign-in
// EF is the post-Auth housekeeping step: it reads the freshly-issued
// JWT, stamps app_metadata.role, lazy-creates the consumer profile row,
// and returns what the caller needs to route (role + onboarded boolean).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

type AppRole = "consumer" | "staff" | "manager" | "admin";

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
  return invokeEF<ConsumerSigninResult>(client, "consumer-signin-phone", {});
}
