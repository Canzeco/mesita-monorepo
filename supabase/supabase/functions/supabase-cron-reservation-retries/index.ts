// Supabase Edge Function — supabase-cron-reservation-retries (artificial caller)
//
// THE waker for every parked reservation leg (RESERVATIONS-PROTOCOL.md). The
// call engine can't sleep (the edge runtime dies at ~400s), so anything that
// must happen later is PARKED on the row and this poller — pg_cron, every
// minute — hands the due ones back to the engine:
//
//   leg 1 · booking      attempts_state='scheduled' + next_attempt_at
//                        (+5 min open / ~30 min after next opening)
//   leg 3 · callback     callback_state='scheduled' + callback_next_attempt_at
//                        (guest ladder: +10 min, +1 h, cap 3, quiet hours)
//                        → engine intent "callback_retry"
//   legs 5/6 · notices   notice_state in pending|scheduled + notice_next_at
//                        (venue: its own hours, cap 2 · guest: the ladder)
//                        → engine intent "cancel_notice" — 'pending' rides too
//                        as the safety net for a cancel EF whose fire-and-
//                        forget engine call was lost.
//   leg 4 · expiry       a pending ticket 4 h past reserved_at goes
//                        'unresolved' right here (no call — nothing to say),
//                        so the app stops claiming Mesita is on the phone
//                        about last night's dinner. `passed` stays DERIVED in
//                        the app; this sweeper never touches confirmed rows.
//
// Safe to run hot: the engine claims each errand compare-and-swap style
// (scheduled→calling / pending|scheduled→running), so an overlapping poll
// loses the swap and skips.
//
// Body: { limit?: number } — per-sweep batch cap (default 25).
// Auth: verify_jwt = true + requireInternalCaller (the pg_cron vault key).
//
// Deploy: supabase functions deploy supabase-cron-reservation-retries

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { invokeArtificialCaller, requireInternalCaller } from "../_shared/internal.ts";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const EXPIRE_AFTER_MS = 4 * 3600_000; // mirrors the app's passed-grace window

// A ticket parked before now is due — including one the poller missed during
// an outage. Late is better than never; each leg's own cap keeps a stale
// ticket from calling forever.
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
  const nowIso = new Date().toISOString();
  const failed: Array<{ id: string; intent: string; error: string }> = [];

  // Sequential on purpose: each engine call acks early (its legs run in the
  // background), so these loops are cheap, and a serial walk keeps a burst of
  // due tickets from opening a pile of simultaneous outbound calls.
  const wake = async (ids: string[], intent: "book" | "callback_retry" | "cancel_notice") => {
    let woken = 0;
    for (const id of ids) {
      const res = await invokeArtificialCaller(
        envRes.env,
        "supabase-cron-reservation-retries",
        "supabase-edgefunc-reservation-call",
        intent === "book" ? { reservation_id: id } : { reservation_id: id, intent },
      );
      if (res.ok) woken++;
      else failed.push({ id, intent, error: res.error });
    }
    return woken;
  };

  // ── Leg 1 · parked booking attempts ────────────────────────────────────────
  const { data: bookRows, error: bookErr } = await admin
    .from("reservations")
    .select("id")
    .eq("status", "pending")
    .eq("attempts_state", "scheduled")
    .not("next_attempt_at", "is", null)
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (bookErr) return json({ ok: false, error: bookErr.message }, 500);
  const bookings = { due: (bookRows ?? []).length, woken: 0 };
  bookings.woken = await wake((bookRows ?? []).map((r) => r.id), "book");

  // ── Leg 3 · parked guest callbacks ─────────────────────────────────────────
  const { data: cbRows } = await admin
    .from("reservations")
    .select("id")
    .in("status", ["pending", "confirmed"])
    .eq("callback_state", "scheduled")
    .not("callback_next_attempt_at", "is", null)
    .lte("callback_next_attempt_at", nowIso)
    .order("callback_next_attempt_at", { ascending: true })
    .limit(limit);
  const callbacks = { due: (cbRows ?? []).length, woken: 0 };
  callbacks.woken = await wake((cbRows ?? []).map((r) => r.id), "callback_retry");

  // ── Legs 5/6 · cancellation notices ────────────────────────────────────────
  // 'scheduled' when due; 'pending' regardless of clock — that state means a
  // cancel EF owed the notice but its engine invocation never landed.
  const { data: ntRows } = await admin
    .from("reservations")
    .select("id")
    .eq("status", "cancelled")
    .or(`notice_state.eq.pending,and(notice_state.eq.scheduled,notice_next_at.lte.${nowIso})`)
    .limit(limit);
  const notices = { due: (ntRows ?? []).length, woken: 0 };
  notices.woken = await wake((ntRows ?? []).map((r) => r.id), "cancel_notice");

  // ── Leg 4 · expire stuck pending tickets ───────────────────────────────────
  // attempts_state guard: never clobber a run that is mid-flight right now.
  const { data: expRows } = await admin
    .from("reservations")
    .update({
      status: "unresolved",
      attempts_state: "exhausted",
      next_attempt_at: null,
      callback_state: "skipped",
      callback_next_attempt_at: null,
      last_call_status: "expired: the reserved time passed while still unconfirmed",
    })
    .eq("status", "pending")
    .lt("reserved_at", new Date(Date.now() - EXPIRE_AFTER_MS).toISOString())
    .or("attempts_state.is.null,attempts_state.neq.running")
    .select("id");

  return json({
    ok: true,
    bookings,
    callbacks,
    notices,
    expired: (expRows ?? []).length,
    failed,
  });
});
