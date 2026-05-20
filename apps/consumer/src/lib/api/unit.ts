// Frontend helper for the manager-get-overview Edge Function.
//
// Wrapped in React.cache so the manager layout and the active page (which
// both need the bundle) reuse a single Edge Function round trip per render.

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MyVenue } from "./venues";
import type { VenueTicket } from "./tickets";
import { invokeEF } from "./_invoke";

export type UnitOverview = {
  user: { id: string; email: string | null };
  venues: MyVenue[];
  active: { venue: MyVenue; recentTickets: VenueTicket[] } | null;
};

async function fetchUnitOverview(
  client: SupabaseClient,
  activeUnitId: string | null,
  ticketsLimit = 20,
): Promise<UnitOverview> {
  return invokeEF<UnitOverview>(client, "manager-get-overview", {
    activeUnitId: activeUnitId ?? undefined,
    ticketsLimit,
  });
}

// `cache` dedupes by argument identity. Within a single server render pass,
// calling `getUnitOverview(client, "abc")` from the layout and the page both
// resolve to the same Promise — exactly one fetch hits the wire.
export const getUnitOverview = cache(fetchUnitOverview);
