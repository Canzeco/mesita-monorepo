// Supabase Edge Function — consumer-web-get-profile
//
// Authenticated. Returns the caller's consumer profile, creating it on first
// call (with sequential 8-digit `code` 0000-0000 for validators / support)
// and returning the consumer profile.
//
// Self-contained: verifies the JWT, does its own DB read/upsert through the
// service role, never calls another Edge Function.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { isCanonicalConsumerCode, writeConsumer } from "../_shared/consumer-doc.ts";
import {
  accountDeletedResponse,
  isDeletedConsumer,
} from "../_shared/delete-history-free.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "GET", "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const admin = adminClient(envRes.env);

  const CONSUMER_PROFILE_SELECT =
    "id, code, full_name, first_name, last_name, sex, birthday, phone, avatar_url, instagram_handle, instagram_followers_count, use_instagram_photo, appear_anonymous, guest_class, plan, vip_partner_id, vip_until, deleted_at";

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

  return json({ ok: true, consumer: { ...rest, vip_partner: vipPartner } });
});
