// Supabase Edge Function — admin-web-delete-place
//
// The admin console's "Delete" is a soft delete: it writes `places.state =
// 'archived'`, the terminal value admin-web-set-place-listed's own comment
// already reserved for this — "archived reads as terminal and is left to
// whatever eventually handles real deletion" (Pato, 2026-08-22). This is
// that door. Archived sits outside the listed set exactly like 'paused'
// does, so the place disappears from every guest surface the same way an
// unlist does; the difference is intent, not mechanism — paused is a
// toggle a re-list reverses, archived is not exposed to any un-delete
// action today.
//
// Body:     { placeId | projectId }
// Response: { ok: true, state: 'archived', place }
//           `place` is the same AdminPlace shape the sibling place-state
//           EFs return, so the console reconciles from one call.
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { PLACE_BUSINESS_COLUMNS } from "../_shared/place-columns.ts";
import { writePlace } from "../_shared/place-doc.ts";

/** The terminal state — reserved by admin-web-set-place-listed's own
 *  comment, never written by the listed toggle. */
const ARCHIVED_STATE = "archived";

type Body = { placeId?: unknown; projectId?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const placeId = readPlaceIdAlias(body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

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

  // Already archived — report success without a write, so a double-click
  // cannot log a second archive event for the same place.
  if (currentState === ARCHIVED_STATE) {
    const { data: place, error: readError } = await admin
      .from("profiles")
      .select(PLACE_BUSINESS_COLUMNS)
      .eq("id", placeId)
      .single();
    if (readError) {
      return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
    }
    return json({ ok: true, state: ARCHIVED_STATE, place });
  }

  const updRes = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: placeId,
    patch: { state: ARCHIVED_STATE },
    select: "id",
    selectMode: "maybeSingle",
  });
  if (!updRes.ok) {
    return json({ ok: false, error: `state_update: ${updRes.error}` }, 500);
  }
  if (!updRes.row) return json({ ok: false, error: "Place not found" }, 404);

  console.log(
    JSON.stringify({
      event: "place_archived",
      place: placeId,
      from: currentState,
      to: ARCHIVED_STATE,
      actor: authRes.user.email ?? authRes.user.id,
    }),
  );

  const { data: place, error: readError } = await admin
    .from("profiles")
    .select(PLACE_BUSINESS_COLUMNS)
    .eq("id", placeId)
    .single();
  if (readError) {
    return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
  }

  return json({ ok: true, state: ARCHIVED_STATE, place });
});
