// Frontend API surface for the business profile.
//
// Same constraints as api/venues + api/tickets: client calls exactly one
// Edge Function per helper, helpers never compose multiple Edge Functions.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type BusinessProfile = {
  id: string;
  full_name: string | null;
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
  input: { full_name?: string | null },
): Promise<BusinessProfile> {
  const { business } = await invokeEF<{ business: BusinessProfile }>(
    client,
    "business-create-profile",
    input,
  );
  return business;
}
