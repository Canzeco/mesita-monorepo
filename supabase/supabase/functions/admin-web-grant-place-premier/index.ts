// Supabase Edge Function — admin-web-grant-place-premier
//
// MESITA-3163: Premier Refill from Manage Multiple › Refill, and the
// operator's pledge removal. Refill days live in place_manual_premier,
// apart from the paid Subscription; the place's level is the higher of the
// two. Days are written only by premier_add_days / premier_end_mesita_days.
//   refill          adds `days` of 2X (tier 1) or 5X (tier 2) to every place,
//                   5X before 2X; one line per Google Place ID. A resent
//                   requestId is answered replayed and adds nothing.
//   end_mesita_days ends every place's admin Refill days (code and bought
//                   days stay); one line per Google Place ID with ended_days.
//   remove_pledge   ends one pledge (`left`, its card detached); a payer's
//                   paid period runs out and nothing renews it. Never refunds.
//
// Body:     { action: "refill", googlePlaceIds: string[1..500], tier: 1|2, days: 1..366, requestId }
//         | { action: "end_mesita_days", googlePlaceIds: string[1..500] }
//         | { placeId | projectId, action: "remove_pledge", backingId: uuid }
// Response: { ok: true, lines: [{ googlePlaceId, placeId, result: ok|refused|unknown,
//             code?, replayed?, ends_at_2x?, ends_at_5x?, ended_days? }] }  (remove_pledge: { ok: true })
// Line codes: not_found · archived · unlisted · paid_higher · cap_reached.
// 400 { ok: false, code, error }: ids_invalid · too_many_ids · tier_invalid · days_invalid ·
//     request_id_invalid. 500 carries request_id.
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { handleGrantPlacePremier } from "../_shared/premier-grant-handler.ts";

serveJson("admin-web-grant-place-premier", (req) => handleGrantPlacePremier(req, "admin-web-grant-place-premier"));
