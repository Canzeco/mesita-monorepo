// Thin client wrapper for the admin-whoami EF. Used by the root layout
// to decide whether to render the global SuperAdminBanner — every signed
// -in render passes through here, so failures are swallowed and treated
// as "not a super-admin" rather than crashing the page.

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type WhoamiResult = {
  email: string | null;
  isSuperAdmin: boolean;
};

async function fetchWhoami(client: SupabaseClient): Promise<WhoamiResult> {
  return invokeEF<WhoamiResult>(client, "admin-whoami", {});
}

// React.cache dedupes calls within a single server render pass so the
// root layout + any nested layout / page asking "are they a super-admin?"
// share one round-trip.
export const getWhoami = cache(fetchWhoami);
