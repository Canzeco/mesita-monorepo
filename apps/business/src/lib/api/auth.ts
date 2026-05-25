// Frontend API surface for the four sign-in / accept-invite EFs.
//
// Same constraint as every other api/*.ts module here: each helper wraps
// exactly one Edge Function — no composition, no chaining. Sign-in EFs
// are the post-Auth housekeeping step: they read the freshly-issued JWT,
// stamp app_metadata.role, lazy-create the profile row, and return what
// the caller needs to route (role + onboarded boolean).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type AppRole = "consumer" | "staff" | "manager" | "admin";

export type ConsumerSigninResult = {
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

export type ManagerSigninResult = {
  role: AppRole;
  manager: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  onboarded: boolean;
};

export async function apiManagerSigninEmail(
  client: SupabaseClient,
): Promise<ManagerSigninResult> {
  return invokeEF<ManagerSigninResult>(client, "manager-signin-email", {});
}

export type AdminSigninResult = {
  role: AppRole;
  email: string;
};

export async function apiAdminSigninEmail(
  client: SupabaseClient,
): Promise<AdminSigninResult> {
  return invokeEF<AdminSigninResult>(client, "admin-signin-email", {});
}

export type StaffAcceptInviteResult = {
  role: AppRole;
  venue_id: string;
};

export async function apiStaffAcceptInvite(
  client: SupabaseClient,
  token: string,
): Promise<StaffAcceptInviteResult> {
  return invokeEF<StaffAcceptInviteResult>(client, "staff-accept-invite", {
    token,
  });
}
