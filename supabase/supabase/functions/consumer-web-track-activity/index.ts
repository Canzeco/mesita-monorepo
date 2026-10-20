// Supabase Edge Function — consumer-web-track-activity
//
// Social v1 (MESITA-2442): records one of the three events on a Mesita place.
//
// Body: { kind: "saved" | "viewed" | "went", place_id: uuid, on?: boolean }
//   saved / went  on: true (default) upserts the row, on: false deletes it
//                 (unsave, take back "I went").
//   viewed        always an upsert; a re-open moves created_at forward so the
//                 feed shows the latest look, once per member × place.
// Response: { ok: true, kind, on }
//
// A Google-only card (`g:<id>`) is refused: it is not a place row yet, and its
// save stays in the browser (lib/saved-places.ts). Recording never checks
// visibility: a member without Instagram still saves; nobody sees it
// (place_activity_visible decides that at read time).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isActivityKind, isMesitaPlaceId } from "../_shared/place-activity.ts";

type Body = { kind?: string; place_id?: string; on?: boolean };

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
  const { kind, place_id: placeId } = bodyRes.body;
  if (!isActivityKind(kind)) {
    return json({ ok: false, error: "kind must be saved, viewed or went" }, 400);
  }
  if (!isMesitaPlaceId(placeId)) {
    return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  }
  const on = kind === "viewed" ? true : bodyRes.body.on !== false;

  const admin = adminClient(envRes.env);
  if (on) {
    const { error } = await admin.from("place_activity").upsert(
      {
        consumer_id: consumerId,
        place_id: placeId,
        kind,
        created_at: new Date().toISOString(),
      },
      { onConflict: "consumer_id,place_id,kind" },
    );
    if (error) {
      // 23503: the place (or the consumer row) does not exist.
      const status = error.code === "23503" ? 404 : 500;
      return json({ ok: false, error: `activity_upsert: ${error.message}` }, status);
    }
  } else {
    const { error } = await admin
      .from("place_activity")
      .delete()
      .eq("consumer_id", consumerId)
      .eq("place_id", placeId)
      .eq("kind", kind);
    if (error) {
      return json({ ok: false, error: `activity_delete: ${error.message}` }, 500);
    }
  }

  return json({ ok: true, kind, on });
});
