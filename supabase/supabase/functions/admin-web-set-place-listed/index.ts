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
import {
  json,
  readJson,
  readPlaceIdAlias,
  serveJson,
} from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { PLACE_PROFILE_COLUMNS } from "../_shared/place-columns.ts";
import { writePlace } from "../_shared/place-doc.ts";
import { isPlaceListed } from "../_shared/place-state.ts";
import { recordAdminOperatorEvent } from "../_shared/admin-operator-events.ts";

/** Where an unlist lands — outside the visible set, and reversible. */
const UNLISTED_STATE = "paused";
/** Where a re-list lands. */
const LISTED_STATE = "active";

type Body = { placeId?: unknown; projectId?: unknown; listed?: unknown };

serveJson("admin-web-set-place-listed", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const placeId = readPlaceIdAlias(body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);
  if (typeof body.listed !== "boolean") {
    return json({ ok: false, error: "listed must be a boolean" }, 400);
  }
  const listed = body.listed;

  const { data: current, error: readCurrent } = await admin
    .from("places")
    .select("state")
    .eq("id", placeId)
    .maybeSingle();
  if (readCurrent) {
    return json({ ok: false, error: `state_read: ${readCurrent.message}` }, 500);
  }
  if (!current) return json({ ok: false, error: "Place not found" }, 404);

  const currentState = (current as { state: string | null }).state ?? "";
  const alreadyListed = isPlaceListed(currentState);

  // Already where the caller wants it — report success without a write, so a
  // double-click or a stale toggle is a no-op.
  if (alreadyListed === listed) {
    const { data: place, error: readError } = await admin
      .from("profiles")
      .select(PLACE_PROFILE_COLUMNS)
      .eq("id", placeId)
      .single();
    if (readError) {
      return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
    }
    return json({ ok: true, listed, state: currentState, place });
  }

  const nextState = listed ? LISTED_STATE : UNLISTED_STATE;
  const updRes = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: placeId,
    patch: { state: nextState },
    select: "id",
    selectMode: "maybeSingle",
  });
  if (!updRes.ok) {
    return json({ ok: false, error: `state_update: ${updRes.error}` }, 500);
  }
  if (!updRes.row) return json({ ok: false, error: "Place not found" }, 404);

  console.log(
    JSON.stringify({
      event: "place_listing_changed",
      place: placeId,
      from: currentState,
      to: nextState,
      actor: user.email ?? user.id,
    }),
  );

  await recordAdminOperatorEvent(admin, {
    verb: "edit",
    outcome: "succeeded",
    placeId,
    actorUserId: user.id,
    source: "admin-web-set-place-listed",
    detail: { action: listed ? "list" : "unlist", from: currentState, to: nextState },
  });

  const { data: place, error: readError } = await admin
    .from("profiles")
    .select(PLACE_PROFILE_COLUMNS)
    .eq("id", placeId)
    .single();
  if (readError) {
    return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
  }

  return json({ ok: true, listed, state: nextState, place });
});
