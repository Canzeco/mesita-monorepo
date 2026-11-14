// Supabase Edge Function — admin-web-update-place-google (MESITA-2737)
//
// Super-admin only. Refreshes Google factuals for one place, never its photos
// (MESITA-3931). Respects field pins,
// never blanks a filled field and never writes the review list (MESITA-3844).
// Does not enqueue Enrich. Audited via source_sync.lastGoogleUpdateAt.
//
// Local:  supabase functions serve admin-web-update-place-google
// Deploy: supabase functions deploy admin-web-update-place-google

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { handleGooglePlaceUpdate } from "../_shared/google-update-handler.ts";

serveJson("admin-web-update-place-google", (req) => handleGooglePlaceUpdate(req, "admin-web-update-place-google"));
