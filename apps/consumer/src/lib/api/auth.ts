// Frontend API surface for the four sign-in / accept-invite EFs.
//
// Same constraint as every other api/*.ts module here: each helper wraps
// exactly one Edge Function — no composition, no chaining. Sign-in EFs
// are the post-Auth housekeeping step: they read the freshly-issued JWT,
// stamp app_metadata.role, lazy-create the profile row, and return what
// the caller needs to route (role + onboarded boolean).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type AppRole = "guest" | "staff" | "manager" | "admin";

export type GuestSigninResult = {
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
