// Frontend API surface for the business profile.
//
// Same constraints as api/venues + api/tickets: client calls exactly one
// Edge Function per helper, helpers never compose multiple Edge Functions.

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
  const { business } = await invokeEF<{ business: BusinessProfile }>(
    client,
    "business-get-profile",
    {},
  );
  return business;
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
    "business-create-profile",
    input,
  );
  return business;
}
