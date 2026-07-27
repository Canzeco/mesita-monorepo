// Supabase Edge Function — consumer-web-cancel-reservation (natural caller)
//
// The guest cancels their OWN reservation from the app — the in-app half of
// the cancel paths (the other two are voice: eleven-a2-cancel-reservation on
// the Confirmer call, eleven-a3-cancel-reservation on the inbound line).
//
//   { reservation_id, reason? }
//
// Ownership is re-checked server-side (consumer_id === caller) — an id alone
// is never authority. Idempotent: cancelling a cancelled ticket is ok:true.
// A ticket whose slot already passed can't be cancelled (409) — there is
// nothing left to call off.
//
// The engine may still have a run in flight; it only ever writes to a ticket
// it already started, and the next status write loses to this one because the
// app reads `status` as the single visible verdict.
//
// Deploy: supabase functions deploy consumer-web-cancel-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";

type Body = { reservation_id?: string; reason?: string };

// A slot is "passed" once it's more than this far behind — the same grace the
// list EF uses to keep tonight's table in Upcoming while you're at it.
const PASSED_GRACE_MS = 4 * 3600_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const id = bodyRes.body.reservation_id;
  if (!id || typeof id !== "string") {
    return json({ ok: false, error: "reservation_id required" }, 400);
  }
  const reason = typeof bodyRes.body.reason === "string"
    ? bodyRes.body.reason.trim().slice(0, 300)
    : "";

  const admin = adminClient(envRes.env);
  const { data: row, error: readErr } = await admin
    .from("reservations")
    .select("id, status, reserved_at, consumer_id, reference_code")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return json({ ok: false, error: readErr.message }, 500);
  // Same answer for "doesn't exist" and "not yours" — never leak existence.
  if (!row || row.consumer_id !== authRes.user.id) {
    return json({ ok: false, error: "Reservation not found" }, 404);
  }

  if (row.status === "cancelled") {
    return json({ ok: true, already: true, reservation_id: id, status: "cancelled" });
  }
  if (new Date(row.reserved_at).getTime() < Date.now() - PASSED_GRACE_MS) {
    return json({ ok: false, error: "This reservation already happened." }, 409);
  }

  const { error } = await admin
    .from("reservations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: "consumer",
      outcome_note: reason || null,
      // Stop the run loop from re-entering on a cancelled ticket.
      attempts_state: "cancelled",
      callback_state: "skipped",
    })
    .eq("id", id);
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({
    ok: true,
    cancelled: true,
    reservation_id: id,
    status: "cancelled",
    reference_code: row.reference_code ?? null,
  });
});
