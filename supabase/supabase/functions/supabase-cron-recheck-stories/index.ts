// Supabase Edge Function — supabase-cron-recheck-stories (internal)
//
// MESITA-4264: pg_cron calls it every 10 minutes (job `recheck-stories`).
// One tick:
//   1. voids the bonus of Stories nobody approved within 7 days
//      (wallet_expire_stories; the paid credit stays);
//   2. re-checks approved Stories whose story_recheck_at has come (at most
//      50): one storyStillUp fetch each (Range bytes=0-0, 10 s timeout), 10
//      at a time, no new row after 100 seconds, then
//      wallet_settle_story_recheck releases the bonus or counts a failure
//      (three, 10 minutes apart, void it). Real Meta mentions are not
//      fetched until story_recheck_meta is on (the P9 spike): released as is;
//   3. deletes unclaimed mentions older than 24 hours (claimed ones stay as
//      the proof behind a bonus);
//   4. with Meta on, fills a mention's missing handle from its sender IGSID
//      (3 tries).
// One bad row logs a JSON line and the batch goes on.
//
// Body: {} | { purchase_id }  (one purchase re-checked now, whatever its
//        story_recheck_at; the same service-role caller)
// Response: { ok: true, processed, released, voided, failed, skipped,
//             expired, swept, handles_filled }
// Auth: verify_jwt = true + requireInternalRequest (the pg_cron vault key).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireInternalRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { pickAccessToken, readInstagramDmConfig } from "../_shared/instagram-dm.ts";
import { errorMessage } from "../_shared/errors.ts";
import { igUsername, readStoryRules, STORY_RULES } from "../_shared/story-mention.ts";
import { recheckOne, recheckRows, runStoryRecheck } from "../_shared/story-recheck.ts";

const FN = "supabase-cron-recheck-stories";

serveJson("supabase-cron-recheck-stories", async (req) => {
  const ctx = requireInternalRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;
  const body = await readJsonOr<{ purchase_id?: unknown }>(req, {});
  const rules = await readStoryRules(admin);

  if (body.purchase_id !== undefined) {
    if (!isUuid(body.purchase_id)) return json({ ok: false, code: "bad_request", error: "purchase_id must be a uuid" }, 400);
    const report = await recheckOne(admin, body.purchase_id, rules.recheckMeta);
    console.log(`[${FN}]`, JSON.stringify({ purchase_id: body.purchase_id, ...report }));
    return json({ ok: true, ...report });
  }

  let expired = 0;
  {
    const { data, error } = await admin.rpc("wallet_expire_stories", { p_limit: STORY_RULES.rowsPerTick });
    if (error) console.error(`[${FN}]`, JSON.stringify({ step: "expire", error: error.message }));
    else expired = Number(data ?? 0);
  }

  const rows = await recheckRows(admin, new Date().toISOString(), STORY_RULES.rowsPerTick);
  const report = await runStoryRecheck(admin, rows, rules.recheckMeta);

  let swept = 0;
  {
    const before = new Date(Date.now() - STORY_RULES.mentionLifeSec * 1000).toISOString();
    const { data, error } = await admin.from("story_mentions").delete().is("purchase_id", null).lt("mentioned_at", before).select("id");
    if (error) console.error(`[${FN}]`, JSON.stringify({ step: "sweep", error: error.message }));
    else swept = (data ?? []).length;
  }

  let handlesFilled = 0;
  const cfg = readInstagramDmConfig();
  if (cfg) {
    try {
      const { data: stored } = await admin.from("meta_instagram_token").select("access_token").maybeSingle();
      const token = pickAccessToken((stored as { access_token?: string } | null)?.access_token, cfg.accessToken);
      const { data, error } = await admin.from("story_mentions")
        .select("id, sender_igsid, handle_tries")
        .is("ig_handle", null).not("sender_igsid", "is", null).lt("handle_tries", STORY_RULES.handleTries)
        .limit(20);
      if (error) throw new Error(`story_mentions: ${error.message}`);
      for (const m of (data ?? []) as Array<{ id: string; sender_igsid: string; handle_tries: number }>) {
        const handle = await igUsername(token, m.sender_igsid).catch(() => null);
        const { error: upErr } = await admin.from("story_mentions")
          .update({ ig_handle: handle, handle_tries: m.handle_tries + 1 }).eq("id", m.id);
        if (upErr) console.error(`[${FN}]`, JSON.stringify({ step: "handle", mention_id: m.id, error: upErr.message }));
        else if (handle) handlesFilled++;
      }
    } catch (e) {
      console.error(`[${FN}]`, JSON.stringify({ step: "handle", error: errorMessage(e) }));
    }
  }

  const out = { ...report, expired, swept, handles_filled: handlesFilled };
  console.log(`[${FN}]`, JSON.stringify(out));
  return json({ ok: true, ...out });
});
