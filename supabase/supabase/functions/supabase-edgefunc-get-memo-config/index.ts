// Supabase Edge Function — supabase-edgefunc-get-memo-config (internal caller)
//
// Memo's own configuration, served to Memo. One of the four endpoints that make
// up Memo's entire data surface (see _shared/memo-data.ts); Memo itself holds
// no database client.
//
// Slices of the `app_config` singleton in ONE read:
//   • greeting     — memo_config.greeting, the consumer Ask AI opener. Null
//                    when blank so clients keep their in-code fallback.
//   • instructions — discovery_config.chat.prompt (Discovery Chat box), else
//                    leftover memo_config.instructions. Null when blank, so
//                    the caller falls back to the in-code SYSTEM_PROMPT.
//   • model        — models_config.memo.model (admin Models page), falling
//                    back to legacy memo_config.openaiModel when unset.
//   • perplexity   — models_config.memo.perplexity ("off" = skip Perplexity).
//   • searchPolicy — leftover wire; Search eligibility is Discovery › Map.
//
// Read side for Memo. Greeting still has no editor (memo_config.greeting).
// The Chat persona writes through admin-web-update-discovery-config
// (discovery_config.chat.prompt) and is preferred here over leftover
// memo_config.instructions.
//
// Naming: actor-origin-verb-noun → supabase · edgefunc · get · memo-config.
// Auth: verify_jwt = true + requireInternalCaller (service-role bearer).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { coerceChannelPolicy } from "../_shared/sourcing.ts";
import { loadModelsConfig } from "../_shared/models-config.ts";
import { normalizeMemoConfig } from "../_shared/memo-config.ts";
import { normalizeDiscoveryConfig } from "../_shared/discovery-config.ts";

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
          "memo_config, discovery_config",
        )
        .eq("id", 1)
        .maybeSingle(),
      loadModelsConfig(admin),
    ]);
    if (error || !data) {
      if (error) console.error("[get-memo-config] read:", error.message);
      return json(fallback);
    }

    const memo = normalizeMemoConfig(
      (data as { memo_config?: unknown }).memo_config,
    );
    const discovery = normalizeDiscoveryConfig(
      (data as { discovery_config?: unknown }).discovery_config,
    );
    const greeting = memo.greeting.trim();
    const chatPrompt = discovery.chat.prompt.trim();
    const instructions = chatPrompt.length > 0
      ? chatPrompt
      : memo.instructions.trim();
    // Models page is SoT; legacy memo_config.openaiModel remains a one-release fallback.
    const legacyModel = memo.openaiModel.trim();
    const model = models.memoModel || legacyModel;
    const perplexity = models.memoPerplexity;

    return json({
      ok: true,
      greeting: greeting.length > 0 ? greeting : null,
      instructions: instructions.length > 0 ? instructions : null,
      model: model.length > 0 ? model : null,
      perplexity: perplexity.length > 0 && perplexity !== "off" ? perplexity : null,
      searchPolicy: coerceChannelPolicy(null, "memo_search"),
      caller: callerRes.callerName,
    });
  } catch (e) {
    console.error("[get-memo-config] threw:", (e as Error).message);
    return json(fallback);
  }
});
