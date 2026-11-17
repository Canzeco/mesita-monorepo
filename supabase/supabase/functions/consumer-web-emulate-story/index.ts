// Supabase Edge Function — consumer-web-emulate-story
//
// MESITA-4264, MESITA-4296: the Meta emulator. Meta is not switched on
// (MESITA-2579), so in Stripe test mode this produces the same mention a real
// Instagram story tagging @mesita would, through the same recorder the
// webhook uses (_shared/story-mention.ts). The guest posts BEFORE paying
// (MESITA-4296), so it belongs to the caller, not to a purchase. Only in test
// mode, and only while the real webhook is not configured; the day the
// META_IG_* secrets land it refuses by itself (meta_on).
//
//   post    copies the bundled sample-story.jpg into the public bucket
//           story-emulator/<consumer>/<n>.jpg (cache-control no-store) and
//           records a mention (source emulator, livemode false) under the
//           guest's verified handle, its URL versioned ?v=<n>. The mention
//           row is written first and n comes from the guest's existing
//           emulator mentions, so a retry overwrites the same file.
//   delete  removes the image of the guest's newest CLAIMED mention (a paid
//           Story waiting on its re-check), else of their newest one, so the
//           re-check's fetch fails exactly as a deleted story's CDN link
//           would.
//
// Body: { action: "post" | "delete" }
// Response: post   { ok: true, action: "post", mention: { id, media_url, media_kind, mentioned_at, source }, n }
//           delete { ok: true, action: "delete", mention_id, n }
//   400 bad_request · 401 (not signed in) · 409 not_test_mode | meta_on |
//   needs_instagram · 404 no_story (nothing to delete) · 500 emulate_failed

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
  emulatorUrl,
  MENTION_COLUMNS,
  type MentionRow,
  mentionView,
  recordStoryMention,
  storageHostOf,
} from "../_shared/story-mention.ts";
import { errorMessage } from "../_shared/errors.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

const FN = "consumer-web-emulate-story";
const BUCKET = "story-emulator";
/** A mention whose image never landed is reused by a retry this soon. */
const RETRY_REUSE_MS = 5 * 60 * 1000;

serveJson("consumer-web-emulate-story", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { action } = bodyRes.body;
  if (action !== "post" && action !== "delete") {
    return json({ ok: false, code: "bad_request", error: "Body needs action post|delete" }, 400);
  }
  const refusal = emulatorRefusal(paymentsLivemode(), readInstagramDmConfig() !== null);
  if (refusal) return json({ ok: false, code: refusal.code, error: refusal.error }, refusal.status);
  const me = user.id;

  try {
    // This guest's emulator stories, newest n first.
    const { data: mineRaw, error: mineErr } = await admin.from("story_mentions")
      .select(`${MENTION_COLUMNS}, ig_story_id, created_at`)
      .eq("source", "emulator").like("ig_story_id", `emu-${me}-%`);
    if (mineErr) throw new Error(`story_mentions: ${mineErr.message}`);
    const mine = ((mineRaw ?? []) as Array<MentionRow & { ig_story_id: string; created_at: string }>)
      .map((m) => ({ ...m, n: emulatorN(m.ig_story_id, me) ?? 0 }))
      .filter((m) => m.n > 0)
      .sort((a, b) => b.n - a.n);

    if (action === "delete") {
      const target = mine.find((m) => m.purchase_id !== null) ?? mine[0];
      if (!target) return json({ ok: false, code: "no_story", error: "No simulated story to delete" }, 404);
      const { error: rmErr } = await admin.storage.from(BUCKET).remove([emulatorPath(me, target.n)]);
      if (rmErr) throw new Error(`storage_remove: ${rmErr.message}`);
      console.log(`[${FN}]`, JSON.stringify({ action, consumer_id: me, mention_id: target.id, n: target.n }));
      return json({ ok: true, action, mention_id: target.id, n: target.n });
    }

    const guest = await readInstagramSyncState(admin, user.id);
    if (!guest.ok) throw new Error(`consumers: ${guest.error}`);
    if (!guest.handle) return json({ ok: false, code: "needs_instagram", error: "Link your Instagram first" }, 409);

    // A retry: the latest unclaimed mention whose image never landed.
    let n = (mine[0]?.n ?? 0) + 1;
    const latest = mine[0];
    if (latest && !latest.purchase_id && Date.now() - Date.parse(latest.created_at) < RETRY_REUSE_MS) {
      const head = await fetch(emulatorUrl(env.url, me, latest.n), { method: "HEAD" });
      await head.body?.cancel();
      if (!head.ok) n = latest.n;
    }

    const mediaUrl = emulatorUrl(env.url, me, n);
    const rec = await recordStoryMention(admin, {
      handle: guest.handle.toLowerCase(),
      source: "emulator",
      storyId: emulatorStoryId(me, n),
      mediaUrl,
      mediaKind: "image",
      mentionedAt: new Date().toISOString(),
      livemode: false,
      senderIgsid: null,
    }, storageHostOf(env.url));

    const bytes = await Deno.readFile(new URL("./sample-story.jpg", import.meta.url));
    const up = await fetch(`${env.url.replace(/\/+$/, "")}/storage/v1/object/${BUCKET}/${emulatorPath(me, n)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.serviceKey}`,
        apikey: env.serviceKey,
        "Content-Type": "image/jpeg",
        "cache-control": "no-store",
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!up.ok) throw new Error(`storage_upload: ${up.status} ${(await up.text()).slice(0, 200)}`);
    await up.body?.cancel();

    const { data: m, error: mErr } = await admin.from("story_mentions").select(MENTION_COLUMNS).eq("id", rec.id).single();
    if (mErr) throw new Error(`story_mentions: ${mErr.message}`);
    console.log(`[${FN}]`, JSON.stringify({ action, consumer_id: me, mention_id: rec.id, n, duplicate: rec.duplicate }));
    return json({ ok: true, action, mention: mentionView(m as MentionRow), n });
  } catch (err) {
    console.error(`[${FN}]`, JSON.stringify({ consumer_id: me, action, error: errorMessage(err) }));
    return json({ ok: false, code: "emulate_failed", error: "Couldn't simulate the story. Try again" }, 500);
  }
});
