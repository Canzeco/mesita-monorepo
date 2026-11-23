// Supabase Edge Function — supabase-cron-verify-stories (internal)
//
// MESITA-4714 (Post): pg_cron calls it every 10 minutes (job
// `verify-stories`). One tick:
//   1. checks up to 20 image stories still checking whose sender is a
//      verified guest (story_ai_claim, 5 at a time, 3 tries each): the image
//      from Meta's CDN, one vision ask (models_config.stories), then
//      story_ai_verdict, which matches the handles and location names read to
//      the places that pay for stories and pays the reward
//      (story_reward_grant) or rejects it with a reason (_shared/story-verify.ts);
//   2. closes stories still checking after 24 hours (story_mentions_expire).
// Emulated stories never come here: consumer-web-simulate-story settles them.
//
// Body: {}
// Response: { ok: true, claimed, rewarded, rejected, failed, unreadable, expired }
// Auth: verify_jwt = true + requireInternalRequest (the pg_cron vault key).
// Needs OPENAI_KEY; without it each claim fails (no_key) and retries.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireInternalRequest } from "../_shared/request.ts";
import { errorMessage } from "../_shared/errors.ts";
import { loadModelsConfig } from "../_shared/models-config.ts";
import { runStoryVerify } from "../_shared/story-verify.ts";

const FN = "supabase-cron-verify-stories";
const BUDGET_MS = 120_000;

serveJson("supabase-cron-verify-stories", async (req) => {
  const startedMs = Date.now();
  const ctx = requireInternalRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  let report = { claimed: 0, rewarded: 0, rejected: 0, failed: 0, unreadable: 0 };
  try {
    const models = await loadModelsConfig(admin);
    report = await runStoryVerify(admin, {
      endAtMs: startedMs + BUDGET_MS,
      batch: 20,
      maxTries: 3,
      model: models.storiesModel,
      key: Deno.env.get("OPENAI_KEY")?.trim() || null,
    });
  } catch (e) {
    console.error(`[${FN}]`, JSON.stringify({ step: "verify", error: errorMessage(e) }));
  }

  let expired = 0;
  const exp = await admin.rpc("story_mentions_expire", {});
  if (exp.error) console.error(`[${FN}]`, JSON.stringify({ step: "expire", error: exp.error.message }));
  else expired = Number(exp.data ?? 0);

  console.log(`[${FN}]`, JSON.stringify({ ...report, expired, ms: Date.now() - startedMs }));
  return json({ ok: true, ...report, expired });
});
