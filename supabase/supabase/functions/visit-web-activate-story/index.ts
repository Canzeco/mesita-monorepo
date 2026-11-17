// Supabase Edge Function — visit-web-activate-story
//
// MESITA-3507, retired by MESITA-4264: the old staff tap. The credit now
// lands at payment and staff approve the story itself through
// visit-web-review-story, so this answers 409 reload for one release (a
// staff page open across the deploy reloads into the new page) and writes
// nothing. A later cleanup retires the folder and its config.toml block.
//
// Body: anything
// Response: 409 { ok: false, code: "reload", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";

serveJson("visit-web-activate-story", (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  return json({ ok: false, code: "reload", error: "This page changed. Reload it." }, 409);
});
