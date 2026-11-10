// Supabase Edge Function — business-web-leave-place
//
// MESITA-3103. The caller stops running a place: their own row is revoked.
// Settings › "Remove this place from my account". They can claim it again.
// The owner of a place with editors hands it over first (MESITA-3120,
// code transfer_first), so a team is never left without its owner.
//
// Body: { place_id: uuid }
// Response: { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("business-web-leave-place", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const mine = await admin.from("place_managers").select("id, role").eq("place_id", placeId).eq("consumer_id", user.id)
    .is("revoked_at", null).maybeSingle();
  if (mine.error) return json({ ok: false, error: mine.error.message }, 500);
  if ((mine.data as { role?: string } | null)?.role === "owner") {
    const others = await admin.from("place_managers").select("id", { count: "exact", head: true }).eq("place_id", placeId)
      .is("revoked_at", null).neq("consumer_id", user.id);
    if (others.error) return json({ ok: false, error: others.error.message }, 500);
    if ((others.count ?? 0) > 0) {
      return json({ ok: false, code: "transfer_first", error: "Make an editor the owner before you leave" }, 409);
    }
  }

  const { data, error } = await admin
    .from("place_managers")
    .update({ revoked_at: new Date().toISOString(), revoked_by: "self", updated_at: new Date().toISOString() })
    .eq("place_id", placeId)
    .eq("consumer_id", user.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!data) return json({ ok: false, code: "not_found", error: "Place not found" }, 404);
  return json({ ok: true });
});
