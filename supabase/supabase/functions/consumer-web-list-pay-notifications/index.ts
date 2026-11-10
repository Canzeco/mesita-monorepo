// Supabase Edge Function — consumer-web-list-pay-notifications
//
// Authenticated. Returns the caller's Me › Notifications rows, newest first:
// the reservation updates _shared/reservation-notification.ts writes (kind
// 'reservation' | 'booking', payload place_name / place_photo_url) and the
// credit_ready rows wallet_notify_ready_credit writes when Pending credit
// turns Available (MESITA-3293). The EF's name predates the screen.
//
// Body: { limit?: number }  // 1..100, default 100

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { CONSUMER_NOTIFICATION_KINDS } from "../_shared/reservation-notification.ts";

type Body = {
  limit?: number;
};

serveJson("consumer-web-list-pay-notifications", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const consumerId = user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const limit = typeof body.limit === "number" && body.limit > 0
    ? Math.min(body.limit, 100)
    : 100;

  const { data, error } = await admin
    .from("consumer_notifications")
    .select("id, consumer_id, kind, payload, created_at")
    .eq("consumer_id", consumerId)
    .in("kind", [...CONSUMER_NOTIFICATION_KINDS])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, notifications: data ?? [] });
});
