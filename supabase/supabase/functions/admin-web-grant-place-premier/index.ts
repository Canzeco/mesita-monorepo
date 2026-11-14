// Supabase Edge Function — admin-web-grant-place-premier
//
// MESITA-3163: the operator's pledge removal. Mesita's manual Upgrade
// (refill, end_mesita_days) is gone (MESITA-3937, Pato: "They do need to
// pay"): those actions answer 410 manual_upgrade_removed.
//   remove_pledge   ends one pledge (`left`, its card detached); a payer's
//                   paid period runs out and nothing renews it. Never refunds.
//
// Body:     { placeId | projectId, action: "remove_pledge", backingId: uuid }
// Response: { ok: true }; refill and end_mesita_days answer 410.
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { handleGrantPlacePremier } from "../_shared/premier-grant-handler.ts";

serveJson("admin-web-grant-place-premier", (req) => handleGrantPlacePremier(req, "admin-web-grant-place-premier"));
