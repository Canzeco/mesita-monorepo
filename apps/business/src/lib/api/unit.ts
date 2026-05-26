// Frontend helper for the business-get-overview Edge Function.
//
// Wrapped in React.cache so the business layout and the active page (which
// both need the bundle) reuse a single Edge Function round trip per render.
// The EF decides super-admin elevation server-side from the caller's JWT
// against public.super_admins; the client never carries a key.

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MyVenue } from "./venues";
import { invokeEF } from "./_invoke";

// The business app never renders a ticket list today — every call site
// passes ticketsLimit = 0, so this stays as an opaque placeholder shape
// matching the EF response. If we ever surface tickets here, replace this
// with the full Ticket type and re-introduce the ticket helpers EF wrappers.
type VenueTicketStub = Record<string, unknown>;

export type UnitOverview = {
  user: { id: string; email: string | null };
  // True when the EF resolved the caller as a super-admin (their email
  // is in public.super_admins). Drives the Topbar banner.
  isSuperAdmin: boolean;
  venues: MyVenue[];
  active: { venue: MyVenue; recentTickets: VenueTicketStub[] } | null;
};

async function fetchUnitOverview(
  client: SupabaseClient,
  activeUnitId: string | null,
  ticketsLimit = 20,
): Promise<UnitOverview> {
  return invokeEF<UnitOverview>(client, "business-get-overview", {
    activeUnitId: activeUnitId ?? undefined,
    ticketsLimit,
  });
}

// `cache` dedupes by argument identity. Within a single server render pass,
// calling `getUnitOverview(client, "abc")` from the layout and the page both
// resolve to the same Promise — exactly one fetch hits the wire.
export const getUnitOverview = cache(fetchUnitOverview);
