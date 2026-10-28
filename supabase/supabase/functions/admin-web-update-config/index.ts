// Supabase Edge Function — admin-web-update-config
//
// THE admin config write. Ten jsonb sections on the public.app_config
// singleton, one door (MESITA-1724, which folded ten per-page updaters in
// here):
//
//   POST { section: "<key>", … }
//
// The rest of the body is the section's own payload, unchanged from the
// function it replaced — `{ config }` for the whole-blob sections, the flat
// knobs for `enricher`, `{ config: { …one switch… } }` for `verification`.
// The response is the section's own success shape, likewise unchanged, so a
// caller only had to grow the `section` field.
//
// This file is a dispatcher and nothing else: CORS, method, env, auth,
// super-admin, look the section up in _shared/config-sections.ts, delegate.
// Per-section validation lives in that section's module — the rewards 409 on a
// stale save, the enricher's image-funnel lock, verification's read-merge-write,
// the models rebuild — never here.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonError, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import {
  CONFIG_SECTION_KEYS,
  writeConfigSection,
} from "../_shared/config-sections.ts";

serveJson("admin-web-update-config", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const userId = user.id;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const key = typeof body.section === "string" ? body.section.trim() : "";
  if (!key) {
    return jsonError(
      `section required — one of ${CONFIG_SECTION_KEYS.join(", ")}`,
      400,
    );
  }

  return await writeConfigSection({ admin, userId, body }, key);
});
