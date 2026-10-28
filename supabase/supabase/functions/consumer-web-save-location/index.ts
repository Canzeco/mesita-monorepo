// Supabase Edge Function — consumer-web-save-location
//
// Writes one of the signed-in guest's saved pins (MESITA-2400). The consumer
// paints the change at once and writes it through here.
//
// Body: { op: "upsert", location: SavedLocationWire, front?: boolean }
//     | { op: "remove", id: string }
//   upsert   inserts the pin, or replaces the one with this id. A new pin
//            goes to the front of the list; an existing one moves there only
//            with `front: true` (a save or a re-confirm does, a backfill that
//            names a pin where it stands does not).
//   remove   deletes the pin; an unknown id is a no-op.
// Response: { ok: true, location? }, or 409 `{ ok: false, code: "full" }`
// when a ninth pin is inserted (the consumer evicts before it saves).
//
// Rows are the caller's own: the consumer id is the JWT's user id, never a
// body field, so a guest can only ever write under their own id.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  fromWire,
  SAVED_LOCATION_COLUMNS,
  SAVED_LOCATIONS_MAX,
  type SavedLocationRow,
  toWire,
} from "../_shared/saved-locations.ts";

type Body = { op?: string; location?: unknown; front?: boolean; id?: unknown };

serveJson("consumer-web-save-location", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const admin = adminClient(envRes.env);

  if (body.op === "remove") {
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return json({ ok: false, error: "id is required" }, 400);
    const { error } = await admin
      .from("saved_locations")
      .delete()
      .eq("consumer_id", consumerId)
      .eq("id", id);
    if (error) {
      return json({ ok: false, error: `saved_locations_delete: ${error.message}` }, 500);
    }
    return json({ ok: true });
  }

  if (body.op !== "upsert") {
    return json({ ok: false, error: "op must be upsert or remove" }, 400);
  }
  const parsed = fromWire(body.location);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const row = parsed.row;

  const { data: existing, error: readError } = await admin
    .from("saved_locations")
    .select("id")
    .eq("consumer_id", consumerId);
  if (readError) {
    return json({ ok: false, error: `saved_locations_read: ${readError.message}` }, 500);
  }
  const ids = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const isNew = !ids.has(row.id);
  if (isNew && ids.size >= SAVED_LOCATIONS_MAX) {
    return json(
      { ok: false, code: "full", error: `at most ${SAVED_LOCATIONS_MAX} saved locations` },
      409,
    );
  }

  const now = new Date().toISOString();
  const write = {
    ...row,
    consumer_id: consumerId,
    location_kind: "point",
    updated_at: now,
    ...(isNew || body.front === true ? { ordered_at: now } : {}),
  };
  const { data, error } = await admin
    .from("saved_locations")
    .upsert(write, { onConflict: "consumer_id,id" })
    .select(SAVED_LOCATION_COLUMNS)
    .single();
  if (error) {
    // 23503: the consumer row does not exist (a deleted account).
    const status = error.code === "23503" ? 404 : 500;
    return json({ ok: false, error: `saved_locations_upsert: ${error.message}` }, status);
  }
  return json({ ok: true, location: toWire(data as SavedLocationRow) });
});
