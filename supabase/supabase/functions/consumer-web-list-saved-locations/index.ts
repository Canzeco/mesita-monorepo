// Supabase Edge Function — consumer-web-list-saved-locations
//
// The signed-in guest's saved pins (MESITA-2400), newest first: the server
// copy of Home's saved locations, so they follow the guest to every device.
// The browser's list is the cache that paints first; the consumer adopts
// this answer on every shell mount (lib/saved-locations.ts › syncSavedLocations).
//
// Body: {} (ignored). Response: { ok: true, locations: SavedLocationWire[] }
//
// Reads only the caller's own rows: the consumer id is the JWT's user id,
// never a body field. Google's names past 30 days are already cleared by the
// daily expire-saved-location-names job, so the row comes back `needsName`
// and the consumer's backfill names it again.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import {
  SAVED_LOCATION_COLUMNS,
  SAVED_LOCATIONS_MAX,
  type SavedLocationRow,
  toWire,
} from "../_shared/saved-locations.ts";

serveJson("consumer-web-list-saved-locations", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const { data, error } = await admin
    .from("saved_locations")
    .select(SAVED_LOCATION_COLUMNS)
    .eq("consumer_id", user.id)
    .order("ordered_at", { ascending: false })
    .limit(SAVED_LOCATIONS_MAX);
  if (error) {
    return json({ ok: false, error: `saved_locations_read: ${error.message}` }, 500);
  }

  return json({
    ok: true,
    locations: ((data ?? []) as SavedLocationRow[]).map(toWire),
  });
});
