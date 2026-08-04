// Supabase Edge Function — consumer-web-update-reservation (natural caller)
//
// The guest RESCHEDULES their own reservation from the app — new slot, party
// size, or note:
//
//   { reservation_id, reserved_at?: ISO, party_size?: number, notes?: string }
//
// New terms mean the venue has to agree again, so this resets the ticket to
// the start of the lifecycle (back to `booking`) and re-fires the call engine:
// status → pending, the previous verdict/confirmation cleared, run state
// wiped, and negotiation_rounds back to 0 — an app reschedule is a deliberate
// human decision, so it earns a fresh pair of agent rounds rather than
// inheriting the cap burned by the last voice negotiation (decision, MESITA-775).
//
// Ownership is re-checked server-side. Cancelled or already-passed tickets
// can't be rescheduled — booking those again is a NEW reservation.
//
// KNOWN RACE (accepted): if a run is mid-flight when the guest reschedules,
// that background task can still write its stale outcome for a minute or two.
// The window is small and the next run overwrites it; a proper run-generation
// token is the follow-up.
//
// Deploy: supabase functions deploy consumer-web-update-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { invokeArtificialCaller } from "../_shared/internal.ts";

type Body = {
  reservation_id?: string;
  reserved_at?: string;
  party_size?: number;
  notes?: string;
};

const PASSED_GRACE_MS = 4 * 3600_000;
const MAX_PARTY = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const id = body.reservation_id;
  if (!id || typeof id !== "string") {
    return json({ ok: false, error: "reservation_id required" }, 400);
  }

  // ── Validate the requested changes ─────────────────────────────────────────
  const patch: Record<string, unknown> = {};
  if (body.reserved_at !== undefined) {
    const when = new Date(String(body.reserved_at));
    if (Number.isNaN(when.getTime())) {
      return json({ ok: false, error: "reserved_at must be an ISO instant" }, 400);
    }
    if (when.getTime() < Date.now()) {
      return json({ ok: false, error: "Pick a time in the future." }, 400);
    }
    patch.reserved_at = when.toISOString();
  }
  if (body.party_size !== undefined) {
    const n = Math.trunc(Number(body.party_size));
    if (!Number.isFinite(n) || n < 1 || n > MAX_PARTY) {
      return json({ ok: false, error: `party_size must be 1–${MAX_PARTY}` }, 400);
    }
    patch.party_size = n;
  }
  if (body.notes !== undefined) {
    patch.notes = String(body.notes).trim().slice(0, 500) || null;
  }
  if (Object.keys(patch).length === 0) {
    return json({ ok: false, error: "Nothing to change." }, 400);
  }

  const admin = adminClient(envRes.env);
  const { data: row, error: readErr } = await admin
    .from("reservations")
    .select("id, status, reserved_at, consumer_id, reference_code")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return json({ ok: false, error: readErr.message }, 500);
  if (!row || row.consumer_id !== authRes.user.id) {
    return json({ ok: false, error: "Reservation not found" }, 404);
  }
  if (row.status === "cancelled") {
    return json({ ok: false, error: "This reservation is cancelled — book a new one." }, 409);
  }
  if (new Date(row.reserved_at).getTime() < Date.now() - PASSED_GRACE_MS) {
    return json({ ok: false, error: "This reservation already happened." }, 409);
  }

  // ── Back to the start of the lifecycle: the venue must agree again ────────
  Object.assign(patch, {
    status: "pending",
    reported_verdict: null,
    alternatives: [],
    guest_confirmed_at: null,
    confirmed_at: null,
    negotiation_rounds: 0,
    attempts: [],
    call_attempts: 0,
    // 'idle' is this column's NOT NULL default — null is rejected outright
    // ("null value in column attempts_state violates not-null constraint").
    // Reset means back to the DEFAULT, not to nothing; same as callback_state.
    attempts_state: "idle",
    callback_state: "none",
    callback_conversation_id: null,
    callback_at: null,
    // MUST clear: if the old ticket was parked for a retry, the pg_cron poller
    // (run-reservation-retries) would still fire on that stale timestamp — a
    // second call to the venue on top of the one this EF triggers below.
    next_attempt_at: null,
    last_conversation_id: null,
    last_called_at: null,
    last_call_status: "rescheduled by the guest — calling the place again",
  });

  const { error } = await admin.from("reservations").update(patch).eq("id", id);
  if (error) return json({ ok: false, error: error.message }, 500);

  // Ask the venue again. The engine acks early and runs the legs in the
  // background, updating this row as it goes.
  const fired = await invokeArtificialCaller(
    envRes.env,
    "consumer-web-update-reservation",
    "supabase-edgefunc-reservation-call",
    { reservation_id: id },
  );

  return json({
    ok: true,
    updated: true,
    reservation_id: id,
    status: "pending",
    reference_code: row.reference_code ?? null,
    reserved_at: (patch.reserved_at as string | undefined) ?? row.reserved_at,
    call_started: fired.ok,
  });
});
