// Supabase Edge Function — consumer-web-register-push
//
// The signed-in guest's own install. Body: { install_id, token }
// A guest id in the body is ignored. An empty token writes no row.
// The test guest's token is not stored.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : "";
}

serveJson("consumer-web-register-push", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user, testGuest } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const installId = text(bodyRes.body.install_id, 80);
  const token = text(bodyRes.body.token, 200);
  if (!installId || !token || testGuest) return json({ ok: true });
  const { error } = await admin.from("consumer_push_tokens").upsert(
    { consumer_id: user.id, install_id: installId, token, updated_at: new Date().toISOString() },
    { onConflict: "consumer_id,install_id" },
  );
  if (error) return json({ ok: false, error: "unavailable" }, 500);
  return json({ ok: true });
});
