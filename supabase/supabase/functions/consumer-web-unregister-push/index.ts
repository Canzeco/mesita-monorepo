// Supabase Edge Function — consumer-web-unregister-push
//
// Drops this install only, for the guest in the session.
// Body: { install_id }
// A guest id in the body is ignored. The test guest has no row.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";

serveJson("consumer-web-unregister-push", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user, testGuest } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const installId = typeof bodyRes.body.install_id === "string" ? bodyRes.body.install_id.trim() : "";
  if (!installId || installId.length > 80 || testGuest) return json({ ok: true });
  const { error } = await admin
    .from("consumer_push_tokens")
    .delete()
    .eq("consumer_id", user.id)
    .eq("install_id", installId);
  if (error) return json({ ok: false, error: "unavailable" }, 500);
  return json({ ok: true });
});
