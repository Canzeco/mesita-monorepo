// Supabase Edge Function — admin-web-suggest-places (product caller)
//
// Manage Single Place name bar. Same Name Deep Search engine as consumer
// Search (`_shared/name-pipeline.ts`, `runAdminNamePipeline`, mode deep):
// Google Autocomplete + Text Search, one list after dropping overlaps. A mode
// other than fast or deep is a 400 `unknown_mode`; Google failing on every
// query a mode ran is a 502 (MESITA-2894).
// Super-admin gated.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { runAdminNamePipeline } from "../_shared/name-pipeline.ts";

type Body = {
  input?: string;
  sessionToken?: string;
  mode?: unknown;
};

serveJson("admin-web-suggest-places", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  // Word by Admin's caps (MESITA-2322), never the consumer bar's.
  return await runAdminNamePipeline(env, {
    input: body.input,
    sessionToken: body.sessionToken,
    mode: body.mode == null ? "deep" : String(body.mode),
  });
});
