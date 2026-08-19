// Supabase Edge Function — consumer-web-add-favorite (product caller)
//
// Toggle a place's bookmark state for the calling consumer. A favorites row
// is a pure bookmark: it issues nothing. A reward comes from SHOWING UP, so
// the rates live on the visit ticket, snapshotted at creation.
//
// Response includes the favorites row (when saved=true).
//
// Local:  supabase functions serve consumer-web-add-favorite
// Deploy: supabase functions deploy consumer-web-add-favorite

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";

type Body = {
  project_id?: string;
  saved?: boolean;
};

Deno.serve(async (req) => {
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

  if (!body.project_id || typeof body.project_id !== "string") {
    return json({ ok: false, error: "project_id required" }, 400);
  }
  if (typeof body.saved !== "boolean") {
    return json({ ok: false, error: "saved (boolean) required" }, 400);
  }

  const admin = adminClient(envRes.env);

  if (body.saved) {
    // Upsert the bookmark. The (consumer_id, project_id) unique constraint
    // means a second save is a no-op at the DB level, so a duplicate save
    // request from the client is harmless.
    const { data: saved, error: saveErr } = await admin
      .from("favorites")
      .upsert(
        { consumer_id: consumerId, project_id: body.project_id },
        { onConflict: "consumer_id,project_id" },
      )
      .select("id, project_id, created_at")
      .single();
    if (saveErr) return json({ ok: false, error: saveErr.message }, 500);

    return json({ ok: true, saved_place: saved });
  }

  // saved === false → delete the bookmark.
  const { error: delErr } = await admin
    .from("favorites")
    .delete()
    .eq("consumer_id", consumerId)
    .eq("project_id", body.project_id);
  if (delErr) return json({ ok: false, error: delErr.message }, 500);

  return json({ ok: true });
});
