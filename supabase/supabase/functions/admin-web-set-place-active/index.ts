// Supabase Edge Function — admin-web-set-place-active
//
// Operator write of State › Active (places.business_state). Pulse / enrich
// still refresh that column from Google; this door is the human override.
//
// Body:     { placeId | projectId, active: boolean }
// Response: { ok: true, active, listed, business_state, place }
// Auth:     caller's JWT email must be in public.super_admins.
//
// Active true  → OPERATIONAL. Does not list.
// Active false → CLOSED_PERMANENTLY. If the place is listed, also paused.
//                One writePlace through profiles so both columns land in
//                one statement.

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
import { isPlaceListed } from "../_shared/place-state.ts";
import { activeWritePatch } from "../_shared/place-active.ts";

type Body = { placeId?: unknown; projectId?: unknown; active?: unknown };

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

  const projectId = readPlaceIdAlias(body);
  if (!projectId) return json({ ok: false, error: "placeId is required" }, 400);
  if (typeof body.active !== "boolean") {
    return json({ ok: false, error: "active must be a boolean" }, 400);
  }
  const active = body.active;

  const { data: current, error: readCurrent } = await admin
    .from("profiles")
    .select("state, business_state")
    .eq("id", projectId)
    .maybeSingle();
  if (readCurrent) {
    return json({ ok: false, error: `state_read: ${readCurrent.message}` }, 500);
  }
  if (!current) return json({ ok: false, error: "Place not found" }, 404);

  const row = current as { state: string | null; business_state: string | null };
  const patch = activeWritePatch(active, row.state);
  const bizSame = row.business_state === patch.business_state;
  const stateSame = !patch.state || patch.state === row.state;
  if (bizSame && stateSame) {
    const { data: place, error: readError } = await admin
      .from("profiles")
      .select(PLACE_BUSINESS_COLUMNS)
      .eq("id", projectId)
      .single();
    if (readError) {
      return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
    }
    return json({
      ok: true,
      active,
      listed: isPlaceListed(row.state),
      business_state: row.business_state,
      state: row.state,
      place,
    });
  }

  const now = new Date().toISOString();
  const updRes = await writePlace(admin, {
    table: "profiles",
    mode: "update",
    id: projectId,
    patch: {
      business_state: patch.business_state,
      business_state_at: now,
      ...(patch.state ? { state: patch.state } : {}),
    },
    select: PLACE_BUSINESS_COLUMNS,
    selectMode: "maybeSingle",
  });
  if (!updRes.ok) {
    return json({ ok: false, error: `active_update: ${updRes.error}` }, 500);
  }
  if (!updRes.row) return json({ ok: false, error: "Place not found" }, 404);

  const nextState = patch.state ?? row.state;
  console.log(
    JSON.stringify({
      event: "place_active_changed",
      project: projectId,
      from: row.business_state,
      to: patch.business_state,
      unlisted: Boolean(patch.state),
      actor: authRes.user.email ?? authRes.user.id,
    }),
  );

  return json({
    ok: true,
    active,
    listed: isPlaceListed(nextState),
    business_state: patch.business_state,
    state: nextState,
    place: updRes.row,
  });
});
