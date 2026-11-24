// Supabase Edge Function — consumer-web-get-profile
//
// Authenticated. Returns the caller's consumer profile, creating it on first
// call (with sequential 8-digit `code` 0000-0000 for validators / support)
// and returning the consumer profile.
//
// Self-contained: verifies the JWT, does its own DB read/upsert through the
// service role, never calls another Edge Function.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { type SocialFacts, socialLevel, socialLock } from "../_shared/social-level.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isCanonicalConsumerCode, writeConsumer } from "../_shared/consumer-doc.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { instagramBadge } from "../_shared/instagram-badge.ts";
import { vipReason } from "../_shared/vip-codes.ts";
import {
  accountDeletedResponse,
  isDeletedConsumer,
} from "../_shared/delete-history-free.ts";

serveJson("consumer-web-get-profile", async (req) => {
  const ctx = await requireConsumerRequest(req, { methods: ["GET", "POST"] });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const userId = user.id;

  const CONSUMER_PROFILE_SELECT =
    "id, code, full_name, first_name, last_name, sex, birthday, birth_year, phone, avatar_url, instagram_handle, instagram_followers_count, instagram_verified_at, instagram_proved_at, instagram_synced_at, use_instagram_photo, instagram_handle_shown, social_private, instagram_followers_emulated, instagram_is_private, guest_class, plan, vip_partner_id, vip_until, vip_invited_at, deleted_at";

  // Read once. If absent, insert with a generated code and re-read.
  const existing = await admin
    .from("consumers")
    .select(CONSUMER_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();
  if (existing.error) {
    return json({ ok: false, error: `consumer_read: ${existing.error.message}` }, 500);
  }

  let consumer = existing.data;
  if (isDeletedConsumer(consumer)) return accountDeletedResponse();
  if (consumer && "deleted_at" in consumer) {
    delete (consumer as { deleted_at?: unknown }).deleted_at;
  }
  if (!consumer) {
    // Generate a code by calling the SQL helper (race-safe via unique
    // constraint; we retry once on conflict).
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const codeResult = await admin.rpc("generate_consumer_code");
      if (codeResult.error) {
        return json({ ok: false, error: `code_gen: ${codeResult.error.message}` }, 500);
      }
      const inserted = await writeConsumer(admin, {
        mode: "insert",
        id: userId,
        patch: { code: codeResult.data as string },
        select: CONSUMER_PROFILE_SELECT,
      });
      if (inserted.ok) {
        consumer = inserted.row as typeof consumer;
        break;
      }
      // Unique-violation on code → retry. Anything else: bail out.
      if (inserted.code !== "23505") {
        return json({ ok: false, error: `consumer_create: ${inserted.error}` }, 500);
      }
    }
    if (!consumer) {
      return json({ ok: false, error: "Could not assign a unique code" }, 500);
    }
  } else if (!consumer.code || !isCanonicalConsumerCode(consumer.code)) {
    // Missing or legacy alphanumeric code → allocate next sequential 8-digit code.
    const codeResult = await admin.rpc("generate_consumer_code");
    if (codeResult.error) {
      return json({ ok: false, error: `code_gen: ${codeResult.error.message}` }, 500);
    }
    const updated = await writeConsumer(admin, {
      mode: "update",
      id: userId,
      patch: { code: codeResult.data as string },
      select: CONSUMER_PROFILE_SELECT,
    });
    if (!updated.ok) {
      return json({ ok: false, error: `consumer_code_set: ${updated.error}` }, 500);
    }
    consumer = updated.row as typeof consumer;
  }

  // MESITA-2556: the guest's own Class sheet names the partner their VIP came
  // through. The id stays server-side; only the name goes out. A failed read
  // drops the name and never fails the profile.
  const { vip_partner_id: partnerId, ...rest } = consumer as typeof consumer & {
    vip_partner_id?: string | null;
  };
  let vipPartner: string | null = null;
  if (partnerId) {
    const partner = await admin
      .from("vip_partners")
      .select("name")
      .eq("id", partnerId)
      .maybeSingle();
    if (partner.error) {
      console.warn("vip_partner_read_failed", JSON.stringify({ error: partner.error.message }));
    } else {
      vipPartner = (partner.data?.name as string | undefined) ?? null;
    }
  }

  // MESITA-4662: Me › Instagram shows the follower emulator in Stripe test
  // mode only.
  // MESITA-4714: the yellow badge, decided here (instagram-badge.ts); the
  // privacy flag itself stays on the server.
  const livemode = paymentsLivemode();
  const { instagram_is_private: _private, ...shown } = rest as typeof rest & { instagram_is_private?: boolean | null };
  return json({
    ok: true,
    consumer: {
      ...shown,
      // MESITA-4850: the privacy level and why it is locked, if it is.
      social_level: socialLevel(rest as unknown as SocialFacts),
      social_lock: socialLock((rest as { birth_year?: number | null }).birth_year),
      vip_partner: vipPartner,
      // MESITA-4766: why this guest is VIP — an invitation code
      // (MESITA-4849); null for a Regular.
      vip_reason: vipReason(rest as { guest_class?: string | null; vip_invited_at?: string | null }),
      emulator_available: !livemode,
      instagram_badge: instagramBadge(rest as Parameters<typeof instagramBadge>[0], livemode),
    },
  });
});

