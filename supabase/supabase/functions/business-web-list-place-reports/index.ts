// Supabase Edge Function — business-web-list-place-reports
//
// MESITA-3104. Super-admin only. Guest reports from the place screen's three dots, from the place page in the
// Business app. The body is `_shared/place-reports-handler.ts`, shared with admin-web-list-place-reports.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { handleListPlaceReports } from "../_shared/place-reports-handler.ts";

serveJson("business-web-list-place-reports", (req) => handleListPlaceReports(req, "business-web-list-place-reports"));
