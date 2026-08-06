// Supabase Edge Function — admin-web-update-memo-config
//
// Naming: caller-verb-words. Caller = admin, verb = update, words = memo-config.
//
// Partial-update of Memo's persona + model config on the public.app_settings
// singleton, written from the admin console's Memo Config page. Each field is
// optional; only keys present in the body are written. Memo is the consumer AI
// concierge (consumer-web-ask-memo) — memo_instructions is read live as its
// system prompt; the model knobs are staged for the Memo model rebuild.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, methodNotAllowed, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  buildMemoConfigPatch,
  type MemoConfigBody,
} from "./memo-config-patch.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return methodNotAllowed();

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<MemoConfigBody>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const built = buildMemoConfigPatch(body);
  if (!built.ok) return built.response;
  const patch = built.patch;
  patch.updated_by = userId;

  const { data, error } = await admin
    .from("app_settings")
    .update(patch)
    .eq("id", 1)
    .select(
      "memo_greeting, memo_instructions, memo_provider, memo_openai_model, memo_web_grounding, memo_perplexity_model, updated_at",
    )
    .single();
  if (error) {
    return json({ ok: false, error: `memo_config_update: ${error.message}` }, 500);
  }

  return json({
    ok: true,
    greeting: data.memo_greeting,
    instructions: data.memo_instructions,
    provider: data.memo_provider,
    openaiModel: data.memo_openai_model,
    webGrounding: data.memo_web_grounding,
    perplexityModel: data.memo_perplexity_model,
    updatedAt: data.updated_at,
  });
});
