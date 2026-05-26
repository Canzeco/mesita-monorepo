// Frontend API surface for the business sign-in EF.
//
// Same constraint as every other api/*.ts module here: each helper wraps
// exactly one Edge Function — no composition, no chaining. The sign-in
// EF is the post-Auth housekeeping step: it reads the freshly-issued JWT,
// stamps app_metadata.role, lazy-creates the profile row, and returns
// what the caller needs to route (role + onboarded boolean).
//
// Each Mesita web app keeps only its own signin wrapper here — the
// consumer / admin / staff cousins live in their respective repos.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type BusinessSigninResult = {
  role: "consumer" | "staff" | "business" | "admin";
  business: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  onboarded: boolean;
};

export async function apiBusinessSigninEmail(
  client: SupabaseClient,
): Promise<BusinessSigninResult> {
  return invokeEF<BusinessSigninResult>(client, "business-signin-email", {});
}
