// Supabase Edge Function — consumer-web-emulate-story
//
// MESITA-4264, MESITA-4296, MESITA-4405: the Meta emulator. Meta is not
// switched on (MESITA-2579), so in Stripe test mode this produces the same
// mention a real Instagram story tagging @mesita would, through the same
// recorder the webhook uses (_shared/story-mention.ts). Only in test mode,
// and only while the real webhook is not configured; the day the META_IG_*
// secrets land it refuses by itself (meta_on).
//
//   connect  a public test account with more than 1,000 followers (or the
//            configured floor, whichever is higher). Meta is not on.
//   post     records a test story tagging @mesita and {place_id}, with no
//            image. story_detect makes the story ticket and attaches it to
//            the open Story voucher at that restaurant. The clock is 30 s
//            from publication.
//   delete   story_drop: the ticket voids at once and the voucher can take
//            another story.
//
// Body: { action: "connect" } | { action: "post", place_id } | { action: "delete" }
// Response: connect { ok: true, action, handle, followers, is_private: false }
//           post    { ok: true, action, mention, n, bound_story_id, story_id }
//           delete  { ok: true, action, mention_id, n }
//   400 bad_request · 401 (not signed in) · 409 not_test_mode | meta_on |
//   needs_instagram · 404 no_story · 500 emulate_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { readInstagramDmConfig } from "../_shared/instagram-dm.ts";
import { readInstagramSyncState } from "../_shared/consumer-doc.ts";
import {
  emulatorN,
  emulatorRefusal,
  emulatorPath,
  emulatorStoryId,
  MENTION_COLUMNS,
  type MentionRow,
  mentionView,
  readStoryRules,
  recordStoryMention,
  storageHostOf,
} from "../_shared/story-mention.ts";
import { errorMessage } from "../_shared/errors.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { isUuid } from "../_shared/place-id.ts";

const FN = "consumer-web-emulate-story";
const BUCKET = "story-emulator";

serveJson("consumer-web-emulate-story", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { action } = bodyRes.body;
  if (action !== "post" && action !== "delete" && action !== "connect") {
    return json({ ok: false, code: "bad_request", error: "Body needs action connect|post|delete" }, 400);
  }
  const placeId = bodyRes.body.place_id;
  if (action === "post" && !isUuid(placeId)) {
    return json({ ok: false, code: "bad_request", field: "place_id", error: "place_id is the restaurant this story tags" }, 400);
  }
  const refusal = emulatorRefusal(paymentsLivemode(), readInstagramDmConfig() !== null, (await readStoryRules(admin)).emulator);
  if (refusal) return json({ ok: false, code: refusal.code, error: refusal.error }, refusal.status);
  const me = user.id;

  try {
    if (action === "connect") {
      const rules = await readStoryRules(admin);
      const followers = Math.max(1001, rules.minFollowers);
      const handle = `emu${me.replace(/-/g, "").slice(0, 12)}`;
      const { error } = await admin.rpc("consumer_instagram_verify", {
        p_consumer_id: me,
        p_handle: handle,
        p_followers: followers,
        p_private: false,
      });
      if (error) throw new Error(`consumer_instagram_verify: ${error.message}`);
      return json({ ok: true, action, handle, followers, is_private: false });
    }

    // This guest's emulator stories, newest n first.
    const { data: mineRaw, error: mineErr } = await admin.from("story_mentions")
      .select(`${MENTION_COLUMNS}, ig_story_id, created_at, review_token, deleted_at`)
      .eq("source", "emulator").like("ig_story_id", `emu-${me}-%`);
    if (mineErr) throw new Error(`story_mentions: ${mineErr.message}`);
    const mine = ((mineRaw ?? []) as Array<MentionRow & { ig_story_id: string; created_at: string; review_token: string | null; deleted_at: string | null }>)
      .map((m) => ({ ...m, n: emulatorN(m.ig_story_id, me) ?? 0 }))
      .filter((m) => m.n > 0)
      .sort((a, b) => b.n - a.n);

    if (action === "delete") {
      const live = mine.filter((m) => !m.deleted_at);
      const target = live[0];
      if (!target) return json({ ok: false, code: "no_story", error: "No simulated story to delete" }, 404);
      const { data, error } = await admin.rpc("story_drop", { p_mention: target.id });
      if (error) throw new Error(`story_drop: ${error.message}`);
      if (target.media_url) {
        const { error: rmErr } = await admin.storage.from(BUCKET).remove([emulatorPath(me, target.n)]);
        if (rmErr) throw new Error(`storage_remove: ${rmErr.message}`);
      }
      console.log(`[${FN}]`, JSON.stringify({ action, consumer_id: me, mention_id: target.id, n: target.n, outcome: (data as { outcome?: string } | null)?.outcome }));
      return json({ ok: true, action, mention_id: target.id, n: target.n });
    }

    const guest = await readInstagramSyncState(admin, user.id);
    if (!guest.ok) throw new Error(`consumers: ${guest.error}`);
    if (!guest.handle) return json({ ok: false, code: "needs_instagram", error: "Link your Instagram first" }, 409);

    const n = (mine[0]?.n ?? 0) + 1;
    const rec = await recordStoryMention(admin, {
      handle: guest.handle.toLowerCase(),
      source: "emulator",
      storyId: emulatorStoryId(me, n),
      mediaUrl: null,
      mediaKind: "image",
      mentionedAt: new Date().toISOString(),
      livemode: false,
      senderIgsid: null,
    }, storageHostOf(env.url));

    const { data: m, error: mErr } = await admin.from("story_mentions").select(MENTION_COLUMNS).eq("id", rec.id).single();
    if (mErr) throw new Error(`story_mentions: ${mErr.message}`);
    const { data: detected, error: detErr } = await admin.rpc("story_detect", { p_mention: rec.id, p_place: placeId });
    if (detErr) throw new Error(`story_detect: ${detErr.message}`);
    const storyId = (detected as { story_id?: string } | null)?.story_id ?? null;
    console.log(`[${FN}]`, JSON.stringify({ action, consumer_id: me, mention_id: rec.id, n, duplicate: rec.duplicate, story_id: storyId, place_id: placeId }));
    return json({ ok: true, action, mention: mentionView(m as MentionRow), n, bound_story_id: storyId, story_id: storyId });
  } catch (err) {
    console.error(`[${FN}]`, JSON.stringify({ consumer_id: me, action, error: errorMessage(err) }));
    return json({ ok: false, code: "emulate_failed", error: "Couldn't simulate the story. Try again" }, 500);
  }
});
