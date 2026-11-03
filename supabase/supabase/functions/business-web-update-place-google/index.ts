// Supabase Edge Function — business-web-update-place-google
//
// MESITA-3157. Super-admin only. Update one place's Google data from its
// Admin page in the Business app (Pato: "add also update button there.
// Enrich, Update"). The body is `_shared/google-update-handler.ts`, shared
// with admin-web-update-place-google.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { handleGooglePlaceUpdate } from "../_shared/google-update-handler.ts";

serveJson("business-web-update-place-google", (req) => handleGooglePlaceUpdate(req, "business-web-update-place-google"));
