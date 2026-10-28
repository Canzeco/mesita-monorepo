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
import { corsPreflight, json, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  SAVED_LOCATION_COLUMNS,
  SAVED_LOCATIONS_MAX,
  type SavedLocationRow,
  toWire,
} from "../_shared/saved-locations.ts";

serveJson("consumer-web-list-saved-locations", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const { data, error } = await adminClient(envRes.env)
    .from("saved_locations")
    .select(SAVED_LOCATION_COLUMNS)
    .eq("consumer_id", authRes.user.id)
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
