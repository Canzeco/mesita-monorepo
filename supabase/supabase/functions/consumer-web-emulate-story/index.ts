// Supabase Edge Function — consumer-web-emulate-story
//
// MESITA-4264, MESITA-4296, MESITA-4405: the Meta emulator. Meta is not
// switched on (MESITA-2579), so in Stripe test mode this produces the same
// mention a real Instagram story tagging @mesita would, through the same
// recorder the webhook uses (_shared/story-mention.ts). Only in test mode,
// and only while the real webhook is not configured; the day the META_IG_*
// secrets land it refuses by itself (meta_on).
//
//   post     "Tag the place": records a test story (source emulator, livemode
//            false) under the guest's verified handle, tagging @mesita and
//            the place, with no image (MESITA-4310). Like the webhook, it
//            binds the story to the guest's Story when they have exactly one
//            open Story waiting for a post (story_bind_handle).
//   delete   marks the guest's newest test story that an approved Story holds
//            (its re-check is ahead), else their newest one, deleted
//            (deleted_at); the re-check then voids the bonus (deleted).
//   approve  MESITA-4307: the waiter's approval, emulated, through the same
//   reject   story_review a real waiter's tap runs (device hash "emulator"),
//            on the guest's own found Story ({story_id}, or their newest
//            found Story at {place_id}) holding a TEST story. A real Meta
//            story is never decided here; a real waiter's page still works.
//
// Body: { action: "post" | "delete" } | { action: "approve" | "reject", story_id? , place_id? }
// Response: post   { ok: true, action, mention: { id, media_url: null, media_kind, mentioned_at, source }, n, bound_story_id }
//           delete { ok: true, action, mention_id, n }
//           approve|reject { ok: true, action, story_id, mention_id, outcome }
//   400 bad_request · 401 (not signed in) · 409 not_test_mode | meta_on |
//   needs_instagram · 404 no_story (nothing to delete or decide) ·
//   409 story_too_old (approve) · 500 emulate_failed

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
  recordStoryMention,
  storageHostOf,
} from "../_shared/story-mention.ts";
import { errorMessage } from "../_shared/errors.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { isUuid } from "../_shared/place-id.ts";
import { reviewRefusal } from "../_shared/story-review.ts";
import { bindMentionToOpenStory, readOwnStory, STORY_RECORD_COLUMNS, type StoryRecord } from "../_shared/story.ts";
import { storyLog } from "../_shared/story-log.ts";

const FN = "consumer-web-emulate-story";
const BUCKET = "story-emulator";

serveJson("consumer-web-emulate-story", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { action } = bodyRes.body;
  if (action !== "post" && action !== "delete" && action !== "approve" && action !== "reject") {
    return json({ ok: false, code: "bad_request", error: "Body needs action post|delete|approve|reject" }, 400);
  }
  const placeId = bodyRes.body.place_id;
  const storyId = bodyRes.body.story_id;
  const deciding = action === "approve" || action === "reject";
  if (deciding && !isUuid(storyId) && !isUuid(placeId)) {
    return json({ ok: false, code: "bad_request", field: "story_id", error: "story_id (or place_id) is needed" }, 400);
  }
  const refusal = emulatorRefusal(paymentsLivemode(), readInstagramDmConfig() !== null);
  if (refusal) return json({ ok: false, code: refusal.code, error: refusal.error }, refusal.status);
  const me = user.id;

  try {
    // This guest's emulator stories, newest n first.
    const { data: mineRaw, error: mineErr } = await admin.from("story_mentions")
      .select(`${MENTION_COLUMNS}, ig_story_id, created_at, review_token, deleted_at`)
      .eq("source", "emulator").like("ig_story_id", `emu-${me}-%`);
    if (mineErr) throw new Error(`story_mentions: ${mineErr.message}`);
    const mine = ((mineRaw ?? []) as Array<MentionRow & { ig_story_id: string; created_at: string; review_token: string | null; deleted_at: string | null }>)
      .map((m) => ({ ...m, n: emulatorN(m.ig_story_id, me) ?? 0 }))
      .filter((m) => m.n > 0)
      .sort((a, b) => b.n - a.n);

    if (deciding) {
      // The guest's own found Story, holding one of their test stories.
      let target: StoryRecord | null = null;
      if (isUuid(storyId)) {
        target = await readOwnStory(admin, me, { storyId });
      } else {
        const { data, error } = await admin.from("stories").select(STORY_RECORD_COLUMNS)
          .eq("consumer_id", me).eq("place_id", placeId as string).eq("state", "found")
          .order("created_at", { ascending: false }).limit(1);
        if (error) throw new Error(`stories: ${error.message}`);
        target = ((data ?? []) as StoryRecord[])[0] ?? null;
      }
      const held = target?.state === "found" ? mine.find((m) => m.id === target!.mention_id) : undefined;
      if (!target || !held?.review_token || !held.review_place_id) {
        return json({ ok: false, code: "no_story", error: "Tag the place first" }, 404);
      }
      const { data, error } = await admin.rpc("story_review", {
        p_token: held.review_token,
        p_place: held.review_place_id,
        p_approve: action === "approve",
        p_device_hash: "emulator",
      });
      if (error) throw new Error(`story_review: ${error.message}`);
      const r = (data ?? {}) as { ok?: boolean; code?: string; outcome?: string };
      console.log(`[${FN}]`, JSON.stringify({ action, story_id: target.id, mention_id: held.id, outcome: r.outcome ?? r.code }));
      if (!r.ok) {
        const refusal = reviewRefusal(r.code);
        return json({ ok: false, code: refusal.code, error: refusal.error }, refusal.status);
      }
      if (r.outcome === "approved" || r.outcome === "rejected") {
        storyLog(r.outcome, {
          story_id: target.id, purchase_id: target.purchase_id, place_id: target.place_id, livemode: target.livemode,
          device_hash: "emulator", via: "emulator",
        });
      }
      return json({ ok: true, action, story_id: target.id, mention_id: held.id, outcome: r.outcome });
    }

    if (action === "delete") {
      const live = mine.filter((m) => !m.deleted_at);
      const { data: held, error: heldErr } = live.length === 0
        ? { data: [], error: null }
        : await admin.from("stories").select("mention_id").eq("consumer_id", me).eq("state", "approved")
          .in("mention_id", live.map((m) => m.id));
      if (heldErr) throw new Error(`stories: ${heldErr.message}`);
      const approved = new Set(((held ?? []) as Array<{ mention_id: string }>).map((h) => h.mention_id));
      const target = live.find((m) => approved.has(m.id)) ?? live[0];
      if (!target) return json({ ok: false, code: "no_story", error: "No simulated story to delete" }, 404);
      const { error: delErr } = await admin.from("story_mentions").update({ deleted_at: new Date().toISOString() }).eq("id", target.id);
      if (delErr) throw new Error(`story_mentions: ${delErr.message}`);
      if (target.media_url) {
        const { error: rmErr } = await admin.storage.from(BUCKET).remove([emulatorPath(me, target.n)]);
        if (rmErr) throw new Error(`storage_remove: ${rmErr.message}`);
      }
      console.log(`[${FN}]`, JSON.stringify({ action, consumer_id: me, mention_id: target.id, n: target.n }));
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
    // Like the webhook: bind it when exactly one Story waits for a post.
    const bound = await bindMentionToOpenStory(admin, rec.id, "emulator");
    console.log(`[${FN}]`, JSON.stringify({ action, consumer_id: me, mention_id: rec.id, n, duplicate: rec.duplicate, bound_story_id: bound }));
    return json({ ok: true, action, mention: mentionView(m as MentionRow), n, bound_story_id: bound });
  } catch (err) {
    console.error(`[${FN}]`, JSON.stringify({ consumer_id: me, action, error: errorMessage(err) }));
    return json({ ok: false, code: "emulate_failed", error: "Couldn't simulate the story. Try again" }, 500);
  }
});
