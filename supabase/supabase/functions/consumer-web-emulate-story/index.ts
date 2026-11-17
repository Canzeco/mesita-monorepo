// Supabase Edge Function — consumer-web-emulate-story
//
// MESITA-4264, MESITA-4297: the Meta emulator. Meta is not switched on
// (MESITA-2579), so in Stripe test mode this produces the same mention a real
// Instagram story tagging @mesita would, through the same recorder the
// webhook uses (_shared/story-mention.ts). Only for the caller's own test-mode
// story check or Story purchase, and only while the real webhook is not
// configured; the day the META_IG_* secrets land it refuses by itself
// (meta_on).
//
// Before payment, keyed on the place (the server finds the caller's open or
// approved check there):
//   post    copies the bundled sample-story.jpg into the public bucket
//           story-emulator/<check>/<n>.jpg (cache-control no-store) and records
//           a mention (source emulator, livemode false, story id
//           emu-<check>-<n>) under the guest's verified handle, its URL
//           versioned ?v=<n>. The mention row is written first and n comes
//           from the check's existing emulator stories, so a retry overwrites
//           the same file.
//   delete  removes the check's claimed story (else its latest one): the image
//           and the row, and an approved check goes back to open.
// After payment, keyed on the purchase:
//   delete  removes the purchase's story image (the row stays), so the
//           re-check's fetch fails exactly as a deleted story's link would.
//
// Body: exactly one of { action: "post" | "delete", place_id: uuid }
//                    or { action: "delete", purchase_id: uuid }
// Response: post   { ok: true, action: "post", mention: { id, media_url, media_kind, mentioned_at, source }, n }
//           delete { ok: true, action: "delete", mention_id, n }
//   400 bad_request · 401 (not signed in) · 403 not_your_purchase ·
//   409 not_test_mode | meta_on | needs_instagram | no_check | no_story_to_delete ·
//   500 emulate_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readInstagramDmConfig } from "../_shared/instagram-dm.ts";
import { readInstagramSyncState } from "../_shared/consumer-doc.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import {
  emulatorN,
  emulatorOwner,
  emulatorPath,
  emulatorStoryId,
  emulatorUrl,
  MENTION_COLUMNS,
  type MentionRow,
  mentionView,
  recordStoryMention,
  storageHostOf,
} from "../_shared/story-mention.ts";
import { readGuestCheck } from "../_shared/story-check.ts";
import { errorMessage } from "../_shared/errors.ts";

const FN = "consumer-web-emulate-story";
const BUCKET = "story-emulator";
/** A mention whose image never landed is reused by a retry this soon. */
const RETRY_REUSE_MS = 5 * 60 * 1000;

type Mine = MentionRow & { ig_story_id: string; created_at: string; n: number };

serveJson("consumer-web-emulate-story", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { action, place_id: placeId, purchase_id: purchaseId } = bodyRes.body;
  const byPlace = isUuid(placeId) && purchaseId === undefined;
  const byPurchase = isUuid(purchaseId) && placeId === undefined;
  if ((action !== "post" && action !== "delete") || byPlace === byPurchase || (byPurchase && action !== "delete")) {
    return json({
      ok: false,
      code: "bad_request",
      error: "Body needs { action: post|delete, place_id } before payment, or { action: delete, purchase_id } after",
    }, 400);
  }
  if (readInstagramDmConfig() !== null) return json({ ok: false, code: "meta_on", error: "Instagram is connected: post a real story" }, 409);
  if (paymentsLivemode()) return json({ ok: false, code: "not_test_mode", error: "The story simulator works only in test mode" }, 409);

  try {
    if (byPurchase) {
      const { data: p, error } = await admin.from("wallet_purchases")
        .select("id, consumer_id, voucher, livemode").eq("id", purchaseId).maybeSingle();
      if (error) throw new Error(`wallet_purchases: ${error.message}`);
      const row = p as { id: string; consumer_id: string | null; voucher: string | null; livemode: boolean } | null;
      if (!row || row.consumer_id !== user.id || row.voucher !== "voucher_story" || row.livemode) {
        return json({ ok: false, code: "not_your_purchase", error: "That is not your test Story voucher" }, 403);
      }
      const { data: m, error: mErr } = await admin.from("story_mentions").select(`${MENTION_COLUMNS}, ig_story_id`)
        .eq("purchase_id", row.id).eq("source", "emulator").maybeSingle();
      if (mErr) throw new Error(`story_mentions: ${mErr.message}`);
      const owner = m ? emulatorOwner((m as { ig_story_id: string }).ig_story_id) : null;
      if (!m || !owner) return json({ ok: false, code: "no_story_to_delete", error: "No simulated story to delete" }, 409);
      const { error: rmErr } = await admin.storage.from(BUCKET).remove([emulatorPath(owner.id, owner.n)]);
      if (rmErr) throw new Error(`storage_remove: ${rmErr.message}`);
      console.log(`[${FN}]`, JSON.stringify({ action, purchase_id: row.id, mention_id: (m as MentionRow).id, n: owner.n }));
      return json({ ok: true, action, mention_id: (m as MentionRow).id, n: owner.n });
    }

    const check = await readGuestCheck(admin, user.id, placeId as string, false);
    if (!check) return json({ ok: false, code: "no_check", error: "Open the Story QR first" }, 409);

    // This check's emulator stories, newest n first.
    const { data: mineRaw, error: mineErr } = await admin.from("story_mentions")
      .select(`${MENTION_COLUMNS}, ig_story_id, created_at`)
      .eq("source", "emulator").like("ig_story_id", `emu-${check.id}-%`);
    if (mineErr) throw new Error(`story_mentions: ${mineErr.message}`);
    const mine: Mine[] = ((mineRaw ?? []) as Array<MentionRow & { ig_story_id: string; created_at: string }>)
      .map((m) => ({ ...m, n: emulatorN(m.ig_story_id, check.id) ?? 0 }))
      .filter((m) => m.n > 0)
      .sort((a, b) => b.n - a.n);

    if (action === "delete") {
      const target = mine.find((m) => m.check_id === check.id) ?? mine[0];
      if (!target) return json({ ok: false, code: "no_story_to_delete", error: "No simulated story to delete" }, 409);
      const { error: rmErr } = await admin.storage.from(BUCKET).remove([emulatorPath(check.id, target.n)]);
      if (rmErr) throw new Error(`storage_remove: ${rmErr.message}`);
      const { error: delErr } = await admin.from("story_mentions").delete().eq("id", target.id).is("purchase_id", null);
      if (delErr) throw new Error(`story_mentions_delete: ${delErr.message}`);
      const { error: reErr } = await admin.rpc("wallet_reopen_story_check", { p_check: check.id });
      if (reErr) throw new Error(`wallet_reopen_story_check: ${reErr.message}`);
      console.log(`[${FN}]`, JSON.stringify({ action, check_id: check.id, mention_id: target.id, n: target.n }));
      return json({ ok: true, action, mention_id: target.id, n: target.n });
    }

    const guest = await readInstagramSyncState(admin, user.id);
    if (!guest.ok) throw new Error(`consumers: ${guest.error}`);
    if (!guest.handle) return json({ ok: false, code: "needs_instagram", error: "Link your Instagram first" }, 409);

    // A retry: the latest unclaimed mention whose image never landed.
    let n = (mine[0]?.n ?? 0) + 1;
    const latest = mine[0];
    if (latest && !latest.check_id && Date.now() - Date.parse(latest.created_at) < RETRY_REUSE_MS) {
      const head = await fetch(emulatorUrl(env.url, check.id, latest.n), { method: "HEAD" });
      await head.body?.cancel();
      if (!head.ok) n = latest.n;
    }

    const mediaUrl = emulatorUrl(env.url, check.id, n);
    const rec = await recordStoryMention(admin, {
      handle: guest.handle.toLowerCase(),
      source: "emulator",
      storyId: emulatorStoryId(check.id, n),
      mediaUrl,
      mediaKind: "image",
      mentionedAt: new Date().toISOString(),
      livemode: false,
      senderIgsid: null,
    }, storageHostOf(env.url));

    const bytes = await Deno.readFile(new URL("./sample-story.jpg", import.meta.url));
    const up = await fetch(`${env.url.replace(/\/+$/, "")}/storage/v1/object/${BUCKET}/${emulatorPath(check.id, n)}`, {
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
    console.log(`[${FN}]`, JSON.stringify({ action, check_id: check.id, mention_id: rec.id, n, duplicate: rec.duplicate }));
    return json({ ok: true, action, mention: mentionView(m as MentionRow), n });
  } catch (err) {
    console.error(`[${FN}]`, JSON.stringify({ place_id: placeId ?? null, purchase_id: purchaseId ?? null, action, error: errorMessage(err) }));
    return json({ ok: false, code: "emulate_failed", error: "Couldn't simulate the story. Try again" }, 500);
  }
});
