// Frontend API surface for the guest sign-in EF.
//
// Same constraint as every other api/*.ts module here: each helper wraps
// exactly one Edge Function — no composition, no chaining. The sign-in
// EF is the post-Auth housekeeping step: it reads the freshly-issued
// JWT, stamps app_metadata.role, lazy-creates the guest profile row,
// and returns what the caller needs to route (role + onboarded boolean).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

type AppRole = "guest" | "staff" | "manager" | "admin";

type GuestSigninResult = {
  role: AppRole;
  guest: {
    id: string;
    code: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  onboarded: boolean;
};

export async function apiGuestSigninPhone(
  client: SupabaseClient,
): Promise<GuestSigninResult> {
  return invokeEF<GuestSigninResult>(client, "guest-signin-phone", {});
}
