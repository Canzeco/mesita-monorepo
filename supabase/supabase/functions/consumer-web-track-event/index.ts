// Supabase Edge Function — consumer-web-track-event
//
// MESITA-1387: the consumer app has zero instrumentation, so every IA call
// (the tabs, the nav restructure) was decided on taste.
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
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";

// Add a new event here before a client ships it.
const ALLOWED_EVENTS = new Set([
  "nav_tab_tap",
  // MESITA-1697 — Home's modes. See track.ts.
  "home_mode_view",
  "home_card_open",
  "home_card_save",
  // MESITA-2590 — Social's "Open Instagram" on the person card, to measure
  // how often a guest leaves for Instagram.
  "social_open_instagram",
  // MESITA-4375 — the offer funnel's baseline before Apple Pay / Google Pay:
  // an offer's sheet opened (with whether a saved card was ready), and a
  // voucher paid (method saved_card until express ships).
  "offer_sheet_opened",
  "voucher_paid",
  // MESITA-4209 — a tap on Home's offer box, with the voucher then showing.
  "offer_chip_tap",
  // MESITA-4384 — express pay: which wallet the phone offered (from the
  // Express Checkout Element's ready), and an express payment that failed.
  "express_ready",
  "express_failed",
  // MESITA-4394 — the reserve-flow Pro offer: You step (blocked or not),
  // the hidden Pro step, and Upgrade.
  "reserve_you_view",
  "reserve_pro_shown",
  "reserve_upgrade_tap",
  // MESITA-4124 — the guest reached a pay step (bill, tip, method, pay).
  "pay_step_view",
]);

/** MESITA-4384: correlation ids are short; a longer one is cut. */
const ID_FIELDS = ["request_id", "purchase_id"] as const;
const ID_MAX = 64;

type Body = { event?: string; payload?: Record<string, unknown> };

serveJson("consumer-web-track-event", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const event = (bodyRes.body.event ?? "").trim();
  if (!ALLOWED_EVENTS.has(event)) {
    return json({ ok: false, error: `Unknown event: ${event}` }, 400);
  }
  const payload: Record<string, unknown> =
    bodyRes.body.payload && typeof bodyRes.body.payload === "object"
      ? { ...bodyRes.body.payload }
      : {};
  for (const f of ID_FIELDS) {
    if (f in payload) payload[f] = typeof payload[f] === "string" ? (payload[f] as string).slice(0, ID_MAX) : null;
  }

  const { error } = await admin.from("consumer_analytics_events").insert({
    consumer_id: user.id,
    event,
    payload,
  });
  if (error) {
    return json({ ok: false, error: `track_insert: ${error.message}` }, 500);
  }

  return json({ ok: true });
});
