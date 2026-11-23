// Supabase Edge Function — supabase-cron-verify-stories (internal)
//
// MESITA-4714, MESITA-4717 (Post): pg_cron calls it every 10 minutes (job
// `verify-stories`). One tick, all automatic (no person reviews any step):
//   1. the first check: up to 20 image stories still checking whose sender is
//      a verified guest (story_ai_claim, 5 at a time, 3 tries each): the image
//      from Meta's CDN, one vision ask (models_config.stories), then
//      story_ai_verdict, which matches the handles and location names read to
//      the places that pay for stories and marks the story verified with no
//      money (story_reward_grant) or rejects it with a reason;
//   2. the recheck: up to 20 verified stories whose recheck_at (10 hours
//      later) is due (story_recheck_claim): still up → story_reward_pay, the
//      credit at once; gone → rejected `removed`; unknown → next tick, paid
//      once the story outlived 24 hours (_shared/story-verify.ts);
//   3. closes stories still checking after 24 hours (story_mentions_expire).
// Emulated stories skip step 1 (consumer-web-simulate-story settles it) and
// pass step 2 two minutes later.
//
// Body: {}
// Response: { ok: true, claimed, verified, rejected, failed, unreadable,
//             rechecked, paid, removed, waiting, errors, expired }
// Auth: verify_jwt = true + requireInternalRequest (the pg_cron vault key).
// Needs OPENAI_KEY for step 1; without it each claim fails (no_key) and retries.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireInternalRequest } from "../_shared/request.ts";
import { errorMessage } from "../_shared/errors.ts";
import { loadModelsConfig } from "../_shared/models-config.ts";
import { runStoryRecheck, runStoryVerify } from "../_shared/story-verify.ts";

const FN = "supabase-cron-verify-stories";
const BUDGET_MS = 120_000;

serveJson("supabase-cron-verify-stories", async (req) => {
  const startedMs = Date.now();
  const ctx = requireInternalRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  let report = { claimed: 0, verified: 0, rejected: 0, failed: 0, unreadable: 0 };
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

  let recheck = { rechecked: 0, paid: 0, removed: 0, waiting: 0, errors: 0 };
  try {
    recheck = await runStoryRecheck(admin, { endAtMs: startedMs + BUDGET_MS, batch: 20 });
  } catch (e) {
    console.error(`[${FN}]`, JSON.stringify({ step: "recheck", error: errorMessage(e) }));
  }

  let expired = 0;
  const exp = await admin.rpc("story_mentions_expire", {});
  if (exp.error) console.error(`[${FN}]`, JSON.stringify({ step: "expire", error: exp.error.message }));
  else expired = Number(exp.data ?? 0);

  console.log(`[${FN}]`, JSON.stringify({ ...report, ...recheck, expired, ms: Date.now() - startedMs }));
  return json({ ok: true, ...report, ...recheck, expired });
});
