// Supabase Edge Function — admin-web-reinstate-guest
//
// MESITA-4899, Admin › Security: ends one suspension. The guest's count of
// closed tickets starts over from now.
//
// Body: { suspension_id }
// Response: { ok: true } · 400 bad_request · 404 gone (none, or already ended)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("admin-web-reinstate-guest", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const id = bodyRes.body.suspension_id;
  if (!isUuid(id)) return json({ ok: false, code: "bad_request", error: "suspension_id must be an id" }, 400);
  const { data, error } = await ctx.admin.from("guest_suspensions")
    .update({ reinstated_at: new Date().toISOString(), reinstated_by: ctx.user.id })
    .eq("id", id).is("reinstated_at", null).select("id").maybeSingle();
  if (error) return json({ ok: false, error: `guest_suspensions: ${error.message}` }, 500);
  if (!data) return json({ ok: false, code: "gone", error: "That suspension already ended." }, 404);
  console.log("guest_reinstated", JSON.stringify({ suspension_id: id }));
  return json({ ok: true });
});
