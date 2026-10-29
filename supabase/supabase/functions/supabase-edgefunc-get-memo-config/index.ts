// Supabase Edge Function — supabase-edgefunc-get-memo-config (internal caller)
//
// Memo's own configuration, served to Memo. The endpoint that makes up Memo's
// entire data surface (see _shared/memo-data.ts); Memo itself holds no database
// client.
//
// Slices of the `app_config` singleton in ONE read:
//   • greeting     — memo_config.greeting, the consumer Ask AI opener. Null
//                    when blank so clients keep their in-code fallback.
//   • instructions — discovery_config.chat.prompt (Discovery › Deep Pipeline
//                    box). Null when blank, so the caller falls back to the
//                    in-code SYSTEM_PROMPT. The leftover
//                    memo_config.instructions persona is no longer served
//                    (MESITA-2338): a blank box means Mesita's default.
//   • model        — models_config.memo.model (admin Models page; never blank,
//                    loadModelsConfig defaults it).
//
// Read side for Memo. Greeting still has no editor (memo_config.greeting).
// The Chat persona writes through admin-web-update-config's `discovery` section
// (discovery_config.chat.prompt).
//
// Naming: actor-origin-verb-noun → supabase · edgefunc · get · memo-config.
// Auth: verify_jwt = true + requireInternalCaller (service-role bearer).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { loadModelsConfig } from "../_shared/models-config.ts";
import { normalizeMemoConfig } from "../_shared/memo-config.ts";
import { normalizeDiscoveryConfig } from "../_shared/discovery-config.ts";
import { errorMessage } from "../_shared/errors.ts";

serveJson("supabase-edgefunc-get-memo-config", async (req) => {
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
  // defaults (null persona → in-code prompt, null model → caller default)
  // instead of failing the turn.
  const fallback = {
    ok: true,
    greeting: null,
    instructions: null,
    model: null,
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
    // A blank box is the in-code default, never the leftover
    // memo_config.instructions persona, which predates the pipelines.
    const instructions = chatPrompt;
    return json({
      ok: true,
      greeting: greeting.length > 0 ? greeting : null,
      instructions: instructions.length > 0 ? instructions : null,
      model: models.memoModel,
      caller: callerRes.callerName,
    });
  } catch (e) {
    console.error("[get-memo-config] threw:", errorMessage(e));
    return json(fallback);
  }
});
