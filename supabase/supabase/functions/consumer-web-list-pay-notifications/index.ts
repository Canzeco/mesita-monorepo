// Supabase Edge Function — consumer-web-list-pay-notifications
//
// Authenticated. Returns the caller's Me › Notifications rows, newest first:
// the reservation updates _shared/reservation-notification.ts writes (kind
// 'reservation' | 'booking', payload place_name / place_photo_url). The EF's
// name predates the screen.
//
// Body: { limit?: number }  // 1..100, default 100

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { RESERVATION_NOTIFICATION_KINDS } from "../_shared/reservation-notification.ts";

type Body = {
  limit?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const limit = typeof body.limit === "number" && body.limit > 0
    ? Math.min(body.limit, 100)
    : 100;

  const { data, error } = await adminClient(envRes.env)
    .from("consumer_notifications")
    .select("id, consumer_id, kind, payload, created_at")
    .eq("consumer_id", consumerId)
    .in("kind", [...RESERVATION_NOTIFICATION_KINDS])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, notifications: data ?? [] });
});
