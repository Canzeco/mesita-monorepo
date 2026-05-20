// Frontend API surface for the manager profile.
//
// Same constraints as api/venues + api/tickets: client calls exactly one
// Edge Function per helper, helpers never compose multiple Edge Functions.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type ManagerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export async function apiGetManagerProfile(
  client: SupabaseClient,
): Promise<ManagerProfile> {
  const { manager } = await invokeEF<{ manager: ManagerProfile }>(
    client,
    "manager-get-profile",
    {},
  );
  return manager;
}

export async function apiCreateManagerProfile(
  client: SupabaseClient,
  input: { full_name?: string | null },
): Promise<ManagerProfile> {
  const { manager } = await invokeEF<{ manager: ManagerProfile }>(
    client,
    "manager-create-profile",
    input,
  );
  return manager;
}
