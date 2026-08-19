// Supabase Edge Function — supabase-cron-reservation-retries (internal)
//
// THE waker for every parked reservation leg (Docs › Reservations §B). The
// call engine can't sleep (the edge runtime dies at ~400s), so anything that
// must happen later is PARKED on the row and this poller — pg_cron, every
// minute — hands the due ones back to the engine.
//
// SWEEP ORDER IS LOAD-BEARING (eng-review 2026-08-04): dead work is buried
// BEFORE live work is woken, so a recovery after a cron outage can never dial
// a venue about a slot that already passed.
//
//   1 · expiry     pending 4 h past reserved_at → 'unresolved' (no call).
//                  `passed` stays DERIVED in the app; confirmed rows are
//                  never touched.
//   2 · moot       owed notices whose slot is 4 h gone → 'skipped' — a
//                  release call about last night's table helps nobody.
//   3 · reaper     claims stuck 'running'/'calling'/'ringing' > 10 min are
//                  ZOMBIES (isolate died mid-run — deploy, wall kill). Every
//                  crash path misses them by construction, so this sweep is
//                  the one net under all of them: back to 'scheduled', due
//                  now, attempts intact; the engine re-claims and resumes.
//   4 · wakes      due bookings (reserved_at-bounded) → intent book · due
//                  callbacks → callback_retry · owed notices → cancel_notice
//                  ('pending' rides regardless of clock — that state means a
//                  cancel EF's fire-and-forget invoke was lost).
//
// Safe to run hot: the engine claims each errand compare-and-swap style
// (rotating run_id), so an overlapping poll loses the swap and skips.
//
// Body: { limit?: number } — per-sweep batch cap (default 25).
// Auth: verify_jwt = true + requireInternalCaller (the pg_cron vault key).
//
// Deploy: supabase functions deploy supabase-cron-reservation-retries

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { invokeInternalCaller, requireInternalCaller } from "../_shared/internal.ts";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const EXPIRE_AFTER_MS = 4 * 3600_000; // mirrors the app's passed-grace window
const STALE_CLAIM_MS = 10 * 60_000; // any leg's longest legal run is < 5 min

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

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
  const expiryFloor = new Date(Date.now() - EXPIRE_AFTER_MS).toISOString();
  const staleClaim = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const failed: Array<{ id: string; intent: string; error: string }> = [];

  // ── 1 · Expiry: bury stuck pending tickets FIRST ───────────────────────────
  const { data: expRows } = await admin
    .from("reservation_tickets")
    .update({
      status: "unresolved",
      attempts_state: "exhausted",
      next_attempt_at: null,
      callback_state: "skipped",
      callback_next_attempt_at: null,
      last_call_status: "expired: the reserved time passed while still unconfirmed",
    })
    .eq("status", "pending")
    .lt("reserved_at", expiryFloor)
    .or("attempts_state.is.null,attempts_state.neq.running")
    .select("id");

  // ── 2 · Moot notices: nobody needs a release call about a passed slot ──────
  const { data: mootRows } = await admin
    .from("reservation_tickets")
    .update({
      notice_state: "skipped",
      notice_next_at: null,
      last_call_status: "cancel notice skipped — the slot already passed",
    })
    .in("notice_state", ["pending", "scheduled"])
    .lt("reserved_at", expiryFloor)
    .select("id");

  // ── 3 · Reaper: zombie claims self-heal here ───────────────────────────────
  const reap = async (
    field: "attempts_state" | "callback_state" | "notice_state",
    zombieStates: string[],
    patch: Record<string, unknown>,
  ) => {
    const { data } = await admin
      .from("reservation_tickets")
      .update({
        ...patch,
        last_call_status: "run reaped — its worker died mid-flight; resuming",
      })
      .in(field, zombieStates)
      .not("claimed_at", "is", null)
      .lt("claimed_at", staleClaim)
      .select("id");
    return (data ?? []).length;
  };
  const reaped = {
    bookings: await reap("attempts_state", ["running"], {
      attempts_state: "scheduled",
      next_attempt_at: nowIso,
    }),
    callbacks: await reap("callback_state", ["calling", "ringing"], {
      callback_state: "scheduled",
      callback_next_attempt_at: nowIso,
    }),
    notices: await reap("notice_state", ["running"], {
      notice_state: "scheduled",
      notice_next_at: nowIso,
    }),
  };

  // ── 4 · Wakes ──────────────────────────────────────────────────────────────
  // Sequential on purpose: each engine call acks early (its legs run in the
  // background), so these loops are cheap, and a serial walk keeps a burst of
  // due tickets from opening a pile of simultaneous outbound calls.
  const wake = async (ids: string[], intent: "book" | "callback_retry" | "cancel_notice") => {
    let woken = 0;
    for (const id of ids) {
      const res = await invokeInternalCaller(
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

  const { data: bookRows, error: bookErr } = await admin
    .from("reservation_tickets")
    .select("id")
    .eq("status", "pending")
    .eq("attempts_state", "scheduled")
    .not("next_attempt_at", "is", null)
    .lte("next_attempt_at", nowIso)
    .gte("reserved_at", expiryFloor) // never dial about an already-buried slot
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (bookErr) return json({ ok: false, error: bookErr.message }, 500);
  const bookings = { due: (bookRows ?? []).length, woken: 0 };
  bookings.woken = await wake((bookRows ?? []).map((r) => r.id), "book");

  const { data: cbRows } = await admin
    .from("reservation_tickets")
    .select("id")
    .in("status", ["pending", "confirmed"])
    .eq("callback_state", "scheduled")
    .not("callback_next_attempt_at", "is", null)
    .lte("callback_next_attempt_at", nowIso)
    .gte("reserved_at", expiryFloor)
    .order("callback_next_attempt_at", { ascending: true })
    .limit(limit);
  const callbacks = { due: (cbRows ?? []).length, woken: 0 };
  callbacks.woken = await wake((cbRows ?? []).map((r) => r.id), "callback_retry");

  // Notices ride on their own columns, not on one status: 'cancelled' is the
  // normal owner, and a failed modification owes a release from 'unreachable'
  // / 'unresolved'. Live tickets are excluded by the engine's gate.
  const { data: ntRows } = await admin
    .from("reservation_tickets")
    .select("id")
    .in("notice_kind", ["venue_cancel", "guest_cancel"])
    .or(`notice_state.eq.pending,and(notice_state.eq.scheduled,notice_next_at.lte.${nowIso})`)
    .limit(limit);
  const notices = { due: (ntRows ?? []).length, woken: 0 };
  notices.woken = await wake((ntRows ?? []).map((r) => r.id), "cancel_notice");

  return json({
    ok: true,
    expired: (expRows ?? []).length,
    moot_notices: (mootRows ?? []).length,
    reaped,
    bookings,
    callbacks,
    notices,
    failed,
  });
});
