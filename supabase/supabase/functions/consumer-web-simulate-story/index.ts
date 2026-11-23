// Supabase Edge Function — consumer-web-simulate-story
//
// MESITA-4714 (Post): the story emulator. Meta's webhook is how a real story
// arrives; while payments run in Stripe test mode a guest with a linked
// Instagram can simulate one from a place's Post tab. It records an
// `emulator` mention for this guest at this place (test mode, never live
// money) and runs its first check at once through story_reward_grant:
// verified (no money yet; the cron rechecks it 2 minutes later and pays,
// MESITA-4717) or a rejection (off, repeat).
//
// Body: { place_id: uuid }
// Response: { ok: true, outcome: verified|rejected, story: StoryView }
//   409 not_test_mode · 409 no_instagram

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import {
  emulatorRefusal,
  emulatorStoryId,
  recordStoryMention,
  STORY_MENTION_COLUMNS,
  type StoryMentionRow,
  storyView,
} from "../_shared/story-reward.ts";

serveJson("consumer-web-simulate-story", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const livemode = paymentsLivemode();
  const { data: guest, error: guestErr } = await admin
    .from("consumers")
    .select("instagram_handle, instagram_verified_at")
    .eq("id", user.id)
    .maybeSingle();
  if (guestErr) return json({ ok: false, error: `consumers: ${guestErr.message}` }, 500);
  const handle = (guest?.instagram_verified_at && guest.instagram_handle) ? String(guest.instagram_handle).toLowerCase() : null;
  const refusal = emulatorRefusal(livemode, handle != null);
  if (refusal) return json({ ok: false, code: refusal.code, error: refusal.error }, refusal.status);

  const now = Date.now();
  const rec = await recordStoryMention(admin, {
    handle,
    source: "emulator",
    storyId: emulatorStoryId(user.id, now),
    mediaUrl: null,
    mediaKind: "image",
    mentionedAt: new Date(now).toISOString(),
    livemode: false,
    senderIgsid: null,
    consumerId: user.id,
    placeId,
  });
  const { data: grant, error: grantErr } = await admin.rpc("story_reward_grant", { p_mention: rec.id, p_place: placeId });
  if (grantErr) return json({ ok: false, error: `story_reward_grant: ${grantErr.message}` }, 500);
  const { data: row, error: rowErr } = await admin.from("story_mentions").select(STORY_MENTION_COLUMNS).eq("id", rec.id).single();
  if (rowErr) return json({ ok: false, error: `story_mentions: ${rowErr.message}` }, 500);
  console.log("[consumer-web-simulate-story]", JSON.stringify({ mention: rec.id, place_id: placeId, outcome: (grant as { outcome?: string })?.outcome }));
  return json({ ok: true, outcome: (grant as { outcome?: string })?.outcome ?? "rejected", story: storyView(row as unknown as StoryMentionRow) });
});
