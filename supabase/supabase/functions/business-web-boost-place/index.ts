// Supabase Edge Function — business-web-boost-place
//
// MESITA-3180: Business › Admin › Special actions › Boost, for Mesita staff on
// one place (Pato: "In special actions, add the button to boost"). The same
// body as admin-web-grant-place-premier (Multiple Places' Boost box): a Boost
// of Premier 2X (tier 1) or 5X (tier 2) for `days`, or ending Mesita's Boost.
// Business calls only business-web-* functions, so this is that door.
//
// Body:     { action: "refill", googlePlaceIds: [one id], tier: 1|2, days: 1..366, requestId }
//         | { action: "end_mesita_days", googlePlaceIds: [one id] }
// Response: { ok: true, lines: [{ googlePlaceId, placeId, result: ok|refused|unknown,
//             code?, replayed?, ends_at_2x?, ends_at_5x?, ended_days? }] }
// Auth:     caller's JWT email must be in public.super_admins (handler opens
//           with requireAdminRequest).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { handleGrantPlacePremier } from "../_shared/premier-grant-handler.ts";

serveJson("business-web-boost-place", (req) => handleGrantPlacePremier(req, "business-web-boost-place"));
