// Supabase Edge Function — admin-web-set-place-active
//
// Operator write of Status › Active (places.business_status). Pulse / enrich
// still refresh that column from Google; this door is the human override.
//
// Body:     { placeId | projectId, active: boolean }
// Response: { ok: true, active, listed, business_status, place }
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
import { isPlaceListed } from "../_shared/place-status.ts";
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
    .select("status, business_status")
    .eq("id", projectId)
    .maybeSingle();
  if (readCurrent) {
    return json({ ok: false, error: `status_read: ${readCurrent.message}` }, 500);
  }
  if (!current) return json({ ok: false, error: "Place not found" }, 404);

  const row = current as { status: string | null; business_status: string | null };
  const patch = activeWritePatch(active, row.status);
  const bizSame = row.business_status === patch.business_status;
  const statusSame = !patch.status || patch.status === row.status;
  if (bizSame && statusSame) {
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
      listed: isPlaceListed(row.status),
      business_status: row.business_status,
      status: row.status,
      place,
    });
  }

  const now = new Date().toISOString();
  const updRes = await writePlace(admin, {
    table: "profiles",
    mode: "update",
    id: projectId,
    patch: {
      business_status: patch.business_status,
      business_status_at: now,
      ...(patch.status ? { status: patch.status } : {}),
    },
    select: PLACE_BUSINESS_COLUMNS,
    selectMode: "maybeSingle",
  });
  if (!updRes.ok) {
    return json({ ok: false, error: `active_update: ${updRes.error}` }, 500);
  }
  if (!updRes.row) return json({ ok: false, error: "Place not found" }, 404);

  const nextStatus = patch.status ?? row.status;
  console.log(
    JSON.stringify({
      event: "place_active_changed",
      project: projectId,
      from: row.business_status,
      to: patch.business_status,
      unlisted: Boolean(patch.status),
      actor: authRes.user.email ?? authRes.user.id,
    }),
  );

  return json({
    ok: true,
    active,
    listed: isPlaceListed(nextStatus),
    business_status: patch.business_status,
    status: nextStatus,
    place: updRes.row,
  });
});
