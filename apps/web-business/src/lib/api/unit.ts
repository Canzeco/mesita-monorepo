// Frontend helper for the business-web-get-overview Edge Function.
//
// Wrapped in React.cache so the business layout and the active page (which
// both need the bundle) reuse a single Edge Function round trip per render.

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MyPlace } from "./places";
import { invokeEF } from "./_invoke";

// The business app never renders a ticket list — request zero tickets.
// recentTickets stays an opaque placeholder matching the EF response.
type PlaceTicketStub = Record<string, unknown>;

type UnitOverview = {
  user: { id: string; email: string | null };
  // EF may still return isSuperAdmin for admin Manage flows; business UI ignores it.
  places: MyPlace[];
  active: { place: MyPlace; recentTickets: PlaceTicketStub[] } | null;
};

async function fetchUnitOverview(
  client: SupabaseClient,
  activeUnitId: string | null,
): Promise<UnitOverview> {
  return invokeEF<UnitOverview>(
    client,
    "business-web-get-overview",
    {
      // Canonical payload key is `placeId` (MESITA-26); local naming unchanged.
      placeId: activeUnitId ?? undefined,
      ticketsLimit: 0,
    },
    "Couldn't load your overview.",
  );
}

// `cache` dedupes by argument identity. Within a single server render pass,
// calling `getUnitOverview(client, "abc")` from the layout and the page both
// resolve to the same Promise — exactly one fetch hits the wire.
export const getUnitOverview = cache(fetchUnitOverview);
