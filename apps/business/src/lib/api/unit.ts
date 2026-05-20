// Frontend helper for the manager-get-overview Edge Function.
//
// Wrapped in React.cache so the manager layout and the active page (which
// both need the bundle) reuse a single Edge Function round trip per render.

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MyVenue } from "./venues";
import type { VenueTicket } from "./tickets";
import { invokeEF } from "./_invoke";
import { getSuperAdminKey } from "@/lib/super-admin";

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
  // Super-admin mode: bypass the Supabase client (which would attach the
  // anon/user session) and call the EF directly with the operator's
  // ADMIN_ACCESS_KEY in the `x-super-admin-key` header. The EF skips JWT
  // + venue_members checks and returns just the requested venue.
  const superKey = await getSuperAdminKey();
  if (superKey) {
    if (!activeUnitId) {
      throw new Error("super-admin overview requires activeUnitId");
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
    }
    const res = await fetch(`${url}/functions/v1/manager-get-overview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-super-admin-key": superKey,
      },
      body: JSON.stringify({ activeUnitId, ticketsLimit }),
      cache: "no-store",
    });
    const text = await res.text();
    const body = (text ? JSON.parse(text) : {}) as
      | ({ ok: true } & UnitOverview)
      | { ok: false; error?: string };
    if (!body.ok) {
      throw new Error(body.error ?? `manager-get-overview HTTP ${res.status}`);
    }
    const { ok: _ok, ...rest } = body;
    void _ok;
    return rest as UnitOverview;
  }
  return invokeEF<UnitOverview>(client, "manager-get-overview", {
    activeUnitId: activeUnitId ?? undefined,
    ticketsLimit,
  });
}

// `cache` dedupes by argument identity. Within a single server render pass,
// calling `getUnitOverview(client, "abc")` from the layout and the page both
// resolve to the same Promise — exactly one fetch hits the wire.
export const getUnitOverview = cache(fetchUnitOverview);
