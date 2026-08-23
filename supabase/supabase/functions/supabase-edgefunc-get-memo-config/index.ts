// Supabase Edge Function — supabase-edgefunc-get-memo-config (internal caller)
//
// Memo's own configuration, served to Memo. One of the four endpoints that make
// up Memo's entire data surface (see _shared/memo-data.ts); Memo itself holds
// no database client.
//
// Four slices of the `app_config` singleton in ONE read:
//   • greeting     — memo_greeting, the consumer Ask AI opener. Null when blank
//                    so clients keep their in-code fallback.
//   • instructions — memo_instructions, the operator-tunable persona. Null
//                    when blank, so the caller falls back to the in-code
//                    SYSTEM_PROMPT and a config hiccup never costs Memo its
//                    voice.
//   • model        — models_config.memo.model (admin Models page), falling
//                    back to legacy memo_openai_model when unset.
//   • perplexity   — models_config.memo.perplexity ("off" = skip Perplexity).
//   • searchPolicy — the `memo_search` slice of sourcing_config, coerced
//                    against the launch policy.
//
// This is the read side ONLY, and today it is the ONLY side — greeting/
// instructions have no live write path (MESITA-1248: admin-web-get-memo-config
// / admin-web-update-memo-config were deleted as dead code, orphaned since
// whatever session retired the admin console's Memo Config page — no frontend
// route called them). Setting these two columns is a direct DB write today;
// building a real editor is its own decision, not implied by this cleanup.
//
// Naming: actor-origin-verb-noun → supabase · edgefunc · get · memo-config.
// Auth: verify_jwt = true + requireInternalCaller (service-role bearer).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import {
  coerceChannelPolicy,
  type SourcingConfigRow,
} from "../_shared/sourcing.ts";
import { loadModelsConfig } from "../_shared/models-config.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const callerRes = requireInternalCaller(req, envRes.env);
  if (!callerRes.ok) return callerRes.response;

  // Body is unused today, but read it so a malformed POST fails the same way
  // every other EF fails rather than throwing mid-handler.
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;

  // Config is Memo's floor, not its ceiling: an unreadable row degrades to
  // defaults (null persona → in-code prompt, null model → caller default,
  // launch sourcing policy) instead of failing the turn.
  const fallback = {
    ok: true,
    greeting: null,
    instructions: null,
    model: null,
    perplexity: null,
    searchPolicy: coerceChannelPolicy(null, "memo_search"),
    caller: callerRes.callerName,
  };

  try {
    const admin = adminClient(envRes.env);
    const [{ data, error }, models] = await Promise.all([
      admin
        .from("app_config")
        .select(
          "memo_greeting, memo_instructions, memo_openai_model, sourcing_config",
        )
        .eq("id", 1)
        .maybeSingle(),
      loadModelsConfig(admin),
    ]);
    if (error || !data) {
      if (error) console.error("[get-memo-config] read:", error.message);
      return json(fallback);
    }

    const greeting = (data.memo_greeting ?? "").toString().trim();
    const instructions = (data.memo_instructions ?? "").toString().trim();
    // Models page is SoT; legacy memo_openai_model remains a one-release fallback.
    const legacyModel = (data.memo_openai_model ?? "").toString().trim();
    const model = models.memoModel || legacyModel;
    const perplexity = models.memoPerplexity;
    const sourcing = data.sourcing_config as SourcingConfigRow | null;

    return json({
      ok: true,
      greeting: greeting.length > 0 ? greeting : null,
      instructions: instructions.length > 0 ? instructions : null,
      model: model.length > 0 ? model : null,
      perplexity: perplexity.length > 0 && perplexity !== "off" ? perplexity : null,
      searchPolicy: coerceChannelPolicy(sourcing?.memo_search ?? null, "memo_search"),
      caller: callerRes.callerName,
    });
  } catch (e) {
    console.error("[get-memo-config] threw:", (e as Error).message);
    return json(fallback);
  }
});
