// Supabase Edge Function — consumer-web-track-event
//
// MESITA-1387: the consumer app has zero instrumentation, so every IA call
// (four tabs, Wallet inside Pay, the nav restructure) was decided on taste.
// This is the whole pipeline — no vendor account, no key, nothing an agent
// would have to create — a row in consumer_analytics_events per call.
//
// Fire-and-forget by design: the client never awaits this meaningfully and
// a failure here must never surface to the guest, so this EF stays a plain
// insert with no side effects and no downstream reads.
//
// Body: { event, payload? }. `event` is checked against a fixed allowlist
// so a typo or a rename on the client can't silently start writing a
// second, uncounted name — add here first, then use it.
//
// Auth: every instrumented screen sits behind (shell)/layout.tsx's auth
// wall already, so this requires a session like the rest of consumer-web.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";

// Add a new event here before a client ships it.
const ALLOWED_EVENTS = new Set([
  "nav_tab_tap",
  "wallet_open",
  "balance_card_tap",
  "ticket_created",
]);

type Body = { event?: string; payload?: Record<string, unknown> };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const event = (bodyRes.body.event ?? "").trim();
  if (!ALLOWED_EVENTS.has(event)) {
    return json({ ok: false, error: `Unknown event: ${event}` }, 400);
  }
  const payload =
    bodyRes.body.payload && typeof bodyRes.body.payload === "object"
      ? bodyRes.body.payload
      : {};

  const admin = adminClient(envRes.env);
  const { error } = await admin.from("consumer_analytics_events").insert({
    consumer_id: authRes.user.id,
    event,
    payload,
  });
  if (error) {
    return json({ ok: false, error: `track_insert: ${error.message}` }, 500);
  }

  return json({ ok: true });
});
