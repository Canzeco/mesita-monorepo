// Supabase Edge Function — business-web-enrich-place
//
// MESITA-3104. Super-admin only. Start the full Enrich for one or more places, from the place page in the
// Business app. The body is `_shared/enrich-place-handler.ts`, shared with admin-web-enrich-place.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { handleEnrichPlace } from "../_shared/enrich-place-handler.ts";

serveJson("business-web-enrich-place", (req) => handleEnrichPlace(req, "business-web-enrich-place"));
