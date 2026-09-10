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
import {
  corsPreflight,
  jsonError,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  CONFIG_SECTION_KEYS,
  writeConfigSection,
} from "../_shared/config-sections.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body ?? {};

  const key = typeof body.section === "string" ? body.section.trim() : "";
  if (!key) {
    return jsonError(
      `section required — one of ${CONFIG_SECTION_KEYS.join(", ")}`,
      400,
    );
  }

  return await writeConfigSection({ admin, userId, body }, key);
});
