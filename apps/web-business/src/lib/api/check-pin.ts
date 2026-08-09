// Frontend helper for business-web-set-check-pin.
//
// Owner-only write door for the optional shared Check PIN (MESITA-823).
// Current value rides on business-web-get-overview's active place for
// owners — see lib/api/unit.ts + MyPlace.check_pin.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export async function apiSetCheckPin(
  client: SupabaseClient,
  input: { projectId: string; pin: string | null },
): Promise<{ pin: string | null }> {
  return invokeEF<{ pin: string | null }>(
    client,
    "business-web-set-check-pin",
    { placeId: input.projectId, pin: input.pin },
    "Couldn't update the Check PIN.",
  );
}
