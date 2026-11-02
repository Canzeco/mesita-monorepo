// Supabase Edge Function — business-web-grant-place-premier
//
// MESITA-3104. Super-admin only. Manual Premier: grant, end, set; remove one pledge, from the place page in the
// Business app. The body is `_shared/premier-grant-handler.ts`, shared with admin-web-grant-place-premier.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { handleGrantPlacePremier } from "../_shared/premier-grant-handler.ts";

serveJson("business-web-grant-place-premier", (req) => handleGrantPlacePremier(req, "business-web-grant-place-premier"));
