// Supabase Edge Function — admin-web-grant-place-premier
//
// MESITA-2995: Single Place › Premier, the operator's writes. Grants are
// Manual Premier (MESITA-3091: place_manual_premier, apart from what guests
// pay; the place's level is the higher of the two).
//   grant         Manual Premier, nothing charged (tier 1..2, 1..12 months);
//                 refused while Manual Premier is running.
//   end           ends the running Manual Premier now.
//   remove_pledge ends one pledge (`left`, its card detached); a payer's
//                 paid period runs out and nothing renews it. Never refunds.
//   set           MESITA-3090, Multiple Places › Edit: move the place's Manual
//                 Premier to tier 0 (End Premier), 1 (2X) or 2 (5X) in one
//                 transaction (premier_set_grant). Refused, nothing written,
//                 only for an archived or unknown place; it never touches a
//                 guest's pledge or period. Errors map in _shared/premier-set.ts.
//
// Body:     { placeId | projectId, action: "grant", tier: 1|2, months?: 1..12 }
//         | { placeId | projectId, action: "end" }
//         | { placeId | projectId, action: "remove_pledge", backingId: uuid }
//         | { placeId | projectId, action: "set", tier: 0|1|2, months: 1..12 | null }
// Response: { ok: true }  (set: { ok, result, ends_at, previous_tier, previous_ends_at })
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { handleGrantPlacePremier } from "../_shared/premier-grant-handler.ts";

serveJson("admin-web-grant-place-premier", (req) => handleGrantPlacePremier(req, "admin-web-grant-place-premier"));
