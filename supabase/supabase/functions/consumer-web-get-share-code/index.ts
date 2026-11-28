// Supabase Edge Function — consumer-web-get-share-code
//
// MESITA-5060: the signed-in guest's share code, made on first ask. Every
// link the guest shares carries it (?s=<code>) so the opens and the new
// guests it brings can be counted (_shared/share-codes.ts).
//
// Body: {}
// Response: { ok: true, code: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { ensureShareCode } from "../_shared/share-codes.ts";

serveJson("consumer-web-get-share-code", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const res = await ensureShareCode(ctx.admin, ctx.user.id);
  if (!res.ok) return json({ ok: false, error: res.error }, 500);
  return json({ ok: true, code: res.code });
});
