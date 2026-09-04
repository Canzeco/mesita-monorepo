// Frontend API surface for the business profile.
//
// Same constraints as api/places: client calls exactly one Edge Function
// per helper, helpers never compose multiple Edge Functions.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type BusinessProfile = {
  id: string;
  // Legacy concat of first + last. EF keeps it populated on every
  // write so existing readers (team list, contracts, sign-in mirror)
  // keep working.
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export async function apiGetBusinessProfile(
  client: SupabaseClient,
): Promise<BusinessProfile> {
  const { manager } = await invokeEF<{ manager: BusinessProfile }>(
    client,
    "business-web-get-manager",
    {},
    "Couldn't load your business profile.",
  );
  return manager;
}

export async function apiCreateBusinessProfile(
  client: SupabaseClient,
  input: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
  },
): Promise<BusinessProfile> {
  const { business } = await invokeEF<{ business: BusinessProfile }>(
    client,
    "business-web-create-manager",
    input,
    "Couldn't create your business profile.",
  );
  return business;
}
