// Supabase Edge Function — supabase-cron-reservation-retries (artificial caller)
//
// The waker for the open-hours-aware retry. The call engine can't sleep 30
// minutes (the edge runtime dies at ~400s), so when a venue doesn't answer it
// PARKS the ticket:
//
//   attempts_state = 'scheduled' · next_attempt_at = <when the retry may fire>
//
// (+5 min if the venue was open, ~30 min after it next opens if it was closed
// — the math lives in _shared/reservation-retry.ts.) A pg_cron job hits this
// endpoint every minute; it finds the tickets whose moment has come and hands
// each back to the engine, which places the next call and either resolves the
// ticket or parks it again.
//
// Safe to run hot: the engine flips the row to 'running' the instant it starts,
// so an overlapping poll simply skips it. Only genuinely pending tickets are
// woken — a cancelled / confirmed / rescheduled ticket no longer matches.
//
// Body: { limit?: number } — batch cap (default 25).
// Auth: verify_jwt = true + requireInternalCaller (the pg_cron vault key).
//
// Deploy: supabase functions deploy supabase-cron-reservation-retries

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { invokeArtificialCaller, requireInternalCaller } from "../_shared/internal.ts";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

// A ticket parked before now is due — including one the poller missed during
// an outage. Late is better than never; the engine's own attempt cap keeps a
// stale ticket from calling forever.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = requireInternalCaller(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<{ limit?: number }>(req, {});
  const limit = typeof body.limit === "number"
    ? Math.max(1, Math.min(MAX_LIMIT, Math.trunc(body.limit)))
    : DEFAULT_LIMIT;

  const admin = adminClient(envRes.env);
  const { data, error } = await admin
    .from("reservations")
    .select("id, reference_code, next_attempt_at")
    .eq("status", "pending")
    .eq("attempts_state", "scheduled")
    .not("next_attempt_at", "is", null)
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (error) return json({ ok: false, error: error.message }, 500);

  const due = data ?? [];
  const woken: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  // Sequential on purpose: each engine call acks early (its legs run in the
  // background), so this loop is cheap, and a serial walk keeps a burst of due
  // tickets from opening a pile of simultaneous outbound calls.
  for (const row of due) {
    const res = await invokeArtificialCaller(
      envRes.env,
      "supabase-cron-reservation-retries",
      "supabase-edgefunc-reservation-call",
      { reservation_id: row.id },
    );
    if (res.ok) woken.push(row.id);
    else failed.push({ id: row.id, error: res.error });
  }

  return json({ ok: true, due: due.length, woken: woken.length, failed });
});
