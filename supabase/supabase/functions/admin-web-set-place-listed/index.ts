// Supabase Edge Function — admin-web-set-place-listed
//
// The ONLY door onto places.state.
//
// Listed is one of the nine facts the admin State box reports — "can a guest
// reach this place on Mesita at all" — and until now it was the only one
// nothing in the product could change. The column is enforced (the consumer
// RLS policy places_select_public_visible gates SELECT on it), and this EF
// is the one thing that writes it. Pato, 2026-08-22: "maybe we want to
// activate or not the place in Mesita."
//
// LISTED is exactly the policy's predicate, not a new idea:
//
//   places_select_public_visible USING
//     state = 'active' AND content_state IN ('ready','generating','failed')
//
// The content_state leg allows every label of its enum, so `state` alone
// decides: listed means `active` (place-state.ts isPlaceListed). Unlisting
// therefore removes the place from every guest surface at once — browse,
// search, and a shared link — because they all read through that
// one policy with the anon key.
//
// Body:     { placeId | projectId, listed: boolean }
// Response: { ok: true, listed, state, place }
//           `place` is the same AdminPlace shape admin-web-update-place
//           returns, so the console reconciles from one call.
// Auth:     caller's JWT email must be in public.super_admins.
//
// UNLIST WRITES 'paused', NOT 'archived'. Both sit outside the visible set, so
// either would hide the place; paused is the reversible one and this is a
// toggle. `archived` reads as terminal and is left to whatever eventually
// handles real deletion.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serveJson } from "../_shared/http.ts";
import { handleSetPlaceListed } from "../_shared/place-listed-handler.ts";

serveJson("admin-web-set-place-listed", (req) => handleSetPlaceListed(req, "admin-web-set-place-listed"));
