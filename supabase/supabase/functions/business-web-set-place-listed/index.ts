// Supabase Edge Function — business-web-set-place-listed
//
// MESITA-3104. Super-admin only. List or unlist a place (places.state active ↔ paused), from the place page in the
// Business app. The body is `_shared/place-listed-handler.ts`, shared with admin-web-set-place-listed.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { handleSetPlaceListed } from "../_shared/place-listed-handler.ts";

serveJson("business-web-set-place-listed", (req) => handleSetPlaceListed(req, "business-web-set-place-listed"));
